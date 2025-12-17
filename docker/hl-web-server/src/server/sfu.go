package main

import (
	"encoding/json"
	"fmt"
	"github.com/gorilla/websocket"
	"github.com/pion/ice/v4"
	"github.com/pion/interceptor"
	"github.com/pion/logging"
	"github.com/pion/rtcp"
	"github.com/pion/rtp"
	"github.com/pion/webrtc/v4"
	"github.com/yohimik/goxash3d-fwgs/pkg"
	"io"
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"sync"
	"time"
)

var net = NewSFUNet()

type SFUNet struct {
	*goxash3d_fwgs.BaseNet
}

func NewSFUNet() *SFUNet {
	return &SFUNet{
		BaseNet: goxash3d_fwgs.NewBaseNet(goxash3d_fwgs.BaseNetOptions{
			HostName: "webxash",
			HostID:   3000,
		}),
	}
}

func (n *SFUNet) SendTo(fd int, packet goxash3d_fwgs.Packet, flags int) int {
	conn := connections[packet.Addr.IP[0]]
	if conn == nil {
		return -1
	}
	nn, err := conn.Write(packet.Data)
	if err != nil {
		return -1
	}
	return nn
}

func (n *SFUNet) SendToBatch(fd int, packets []goxash3d_fwgs.Packet, flags int) int {
	sum := 0
	for _, packet := range packets {
		nn := n.SendTo(fd, packet, flags)
		if nn == -1 {
			return -1
		}
		sum += nn
	}
	return sum
}

var pool = goxash3d_fwgs.NewBytesPool(256)
var connections = make([]io.Writer, 256)

var (
	addr     = ":27016"
	upgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool { return true },
	}

	api *webrtc.API

	// lock for peerConnections and trackLocals
	listLock        sync.RWMutex
	peerConnections []*peerConnectionState
	trackLocals     map[string]*webrtc.TrackLocalStaticRTP

	log = logging.NewDefaultLoggerFactory().NewLogger("sfu-ws")
)

type websocketMessage struct {
	Event string          `json:"event"`
	Data  json.RawMessage `json:"data"`
}

type peerConnectionState struct {
	peerConnection *webrtc.PeerConnection
	websocket      *threadSafeWriter
	signalsCount   int
}

const DefaultSignalsCount = 5

// Add to list of tracks and fire renegotation for all PeerConnections.
func addTrack(t *webrtc.TrackRemote) *webrtc.TrackLocalStaticRTP { // nolint
	listLock.Lock()
	defer func() {
		listLock.Unlock()
		signalPeerConnections()
	}()

	// Create a new TrackLocal with the same codec as our incoming
	trackLocal, err := webrtc.NewTrackLocalStaticRTP(t.Codec().RTPCodecCapability, t.ID(), t.StreamID())
	if err != nil {
		panic(err)
	}

	trackLocals[t.ID()] = trackLocal

	for _, con := range peerConnections {
		con.signalsCount = DefaultSignalsCount
	}

	return trackLocal
}

// Remove from list of tracks and fire renegotation for all PeerConnections.
func removeTrack(t *webrtc.TrackLocalStaticRTP) {
	listLock.Lock()
	defer func() {
		listLock.Unlock()
		signalPeerConnections()
	}()

	for _, con := range peerConnections {
		con.signalsCount = DefaultSignalsCount
	}

	delete(trackLocals, t.ID())
}

// signalPeerConnections updates each PeerConnection so that it is getting all the expected media tracks.
func signalPeerConnections() { // nolint
	listLock.Lock()
	defer func() {
		listLock.Unlock()
		dispatchKeyFrame()
	}()

	attemptSync := func() (tryAgain bool) {
		for i := range peerConnections {
			if peerConnections[i].signalsCount <= 0 {
				continue
			}

			if peerConnections[i].peerConnection.ConnectionState() == webrtc.PeerConnectionStateClosed {
				peerConnections = append(peerConnections[:i], peerConnections[i+1:]...)

				return true // We modified the slice, start from the beginning
			}

			// map of sender we already are seanding, so we don't double send
			existingSenders := map[string]bool{}

			for _, sender := range peerConnections[i].peerConnection.GetSenders() {
				if sender.Track() == nil {
					continue
				}

				existingSenders[sender.Track().ID()] = true

				// If we have a RTPSender that doesn't map to a existing track remove and signal
				if _, ok := trackLocals[sender.Track().ID()]; !ok {
					if err := peerConnections[i].peerConnection.RemoveTrack(sender); err != nil {
						return true
					}
				}
			}

			// Don't receive videos we are sending, make sure we don't have loopback
			for _, receiver := range peerConnections[i].peerConnection.GetReceivers() {
				if receiver.Track() == nil {
					continue
				}

				existingSenders[receiver.Track().ID()] = true
			}

			// Add all track we aren't sending yet to the PeerConnection
			for trackID := range trackLocals {
				if _, ok := existingSenders[trackID]; !ok {
					if _, err := peerConnections[i].peerConnection.AddTrack(trackLocals[trackID]); err != nil {
						return true
					}
				}
			}

			offer, err := peerConnections[i].peerConnection.CreateOffer(nil)
			if err != nil {
				return true
			}

			if err = peerConnections[i].peerConnection.SetLocalDescription(offer); err != nil {
				return true
			}

			if err = peerConnections[i].websocket.WriteJSON("offer", offer); err != nil {
				return true
			}
		}

		return tryAgain
	}

	for syncAttempt := 0; ; syncAttempt++ {
		if syncAttempt == 25 {
			// Release the lock and attempt a sync in 3 seconds. We might be blocking a RemoveTrack or AddTrack
			go func() {
				time.Sleep(time.Second * 3)
				signalPeerConnections()
			}()

			return
		}

		if !attemptSync() {
			break
		}
	}
}

// dispatchKeyFrame sends a keyframe to all PeerConnections, used everytime a new user joins the call.
func dispatchKeyFrame() {
	listLock.Lock()
	defer listLock.Unlock()

	for i := range peerConnections {
		for _, receiver := range peerConnections[i].peerConnection.GetReceivers() {
			if receiver.Track() == nil {
				continue
			}

			_ = peerConnections[i].peerConnection.WriteRTCP([]rtcp.Packet{
				&rtcp.PictureLossIndication{
					MediaSSRC: uint32(receiver.Track().SSRC()),
				},
			})
		}
	}
}

const messageSize = 1024 * 8

func ReadLoop(d io.Reader, ip [4]byte) {
	for {
		buffer := make([]byte, messageSize)
		n, err := d.Read(buffer)
		if err != nil {
			fmt.Println("Datachannel closed; Exit the readloop:", err)

			return
		}
		net.PushPacket(goxash3d_fwgs.Packet{
			Addr: goxash3d_fwgs.Addr{
				IP:   ip,
				Port: 1000,
			},
			Data: buffer[:n],
		})
	}
}

// Handle incoming websockets.
func websocketHandler(w http.ResponseWriter, r *http.Request) { // nolint
	// Upgrade HTTP request to Websocket
	unsafeConn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Errorf("Failed to upgrade HTTP to Websocket: ", err)

		return
	}

	c := &threadSafeWriter{unsafeConn, sync.Mutex{}} // nolint

	// When this frame returns close the Websocket
	defer c.Close() //nolint

	// Create new PeerConnection
	peerConnection, err := api.NewPeerConnection(webrtc.Configuration{})
	if err != nil {
		log.Errorf("Failed to creates a PeerConnection: %v", err)

		return
	}

	// When this frame returns close the PeerConnection
	defer peerConnection.Close() //nolint

	// Accept one audio track incoming
	for _, typ := range []webrtc.RTPCodecType{webrtc.RTPCodecTypeAudio} {
		if _, err := peerConnection.AddTransceiverFromKind(typ, webrtc.RTPTransceiverInit{
			Direction: webrtc.RTPTransceiverDirectionRecvonly,
		}); err != nil {
			log.Errorf("Failed to add transceiver: %v", err)

			return
		}
	}

	f := false
	var z uint16 = 0
	if err != nil {
		log.Errorf("Failed to creates a data channel: %v", err)

		return
	}
	ip := [4]byte{}
	for i := range ip {
		ip[i] = byte(rand.Intn(256))
	}
	index, _ := pool.TryGet()
	ip[0] = index
	defer pool.TryPut(index)

	writeChannel, err := peerConnection.CreateDataChannel("write", &webrtc.DataChannelInit{
		Ordered:        &f,
		MaxRetransmits: &z,
	})
	if err != nil {
		log.Errorf("Failed to creates a data channel: %v", err)

		return
	}
	var readChannel *webrtc.DataChannel
	defer func() {
		if readChannel != nil {
			readChannel.Close()
		}
	}()
	writeChannel.OnOpen(func() {
		d, err := writeChannel.Detach()
		if err != nil {
			panic(err)
		}
		connections[index] = d

		rc, err := peerConnection.CreateDataChannel("read", &webrtc.DataChannelInit{
			Ordered:        &f,
			MaxRetransmits: &z,
		})
		if err != nil {
			log.Errorf("Failed to creates a data channel: %v", err)

			return
		}
		readChannel = rc
		readChannel.OnOpen(func() {
			d, err := readChannel.Detach()
			if err != nil {
				panic(err)
			}
			go ReadLoop(d, ip)
		})
	})
	defer writeChannel.Close()

	// Trickle ICE. Emit server candidate to client
	peerConnection.OnICECandidate(func(i *webrtc.ICECandidate) {
		if i == nil {
			return
		}
		// If you are serializing a candidate make sure to use ToJSON
		// Using Marshal will result in errors around `sdpMid`

		if writeErr := c.WriteJSON("candidate", i.ToJSON()); writeErr != nil {
			log.Errorf("Failed to write JSON: %v", writeErr)
		}
	})

	// If PeerConnection is closed remove it from global list
	peerConnection.OnConnectionStateChange(func(p webrtc.PeerConnectionState) {
		switch p {
		case webrtc.PeerConnectionStateFailed:
			if err := peerConnection.Close(); err != nil {
				log.Errorf("Failed to close PeerConnection: %v", err)
			}
		case webrtc.PeerConnectionStateClosed:
			signalPeerConnections()
		default:
		}
	})

	peerConnection.OnTrack(func(t *webrtc.TrackRemote, _ *webrtc.RTPReceiver) {
		// Create a track to fan out our incoming video to all peers
		trackLocal := addTrack(t)
		defer removeTrack(trackLocal)

		buf := make([]byte, 1500)
		rtpPkt := &rtp.Packet{}

		for {
			i, _, err := t.Read(buf)
			if err != nil {
				return
			}

			if err = rtpPkt.Unmarshal(buf[:i]); err != nil {
				log.Errorf("Failed to unmarshal incoming RTP packet: %v", err)

				return
			}

			rtpPkt.Extension = false
			rtpPkt.Extensions = nil

			if err = trackLocal.WriteRTP(rtpPkt); err != nil {
				return
			}
		}
	})

	// Add our new PeerConnection to global list
	state := peerConnectionState{peerConnection, c, DefaultSignalsCount}
	listLock.Lock()
	peerConnections = append(peerConnections, &state)
	listLock.Unlock()

	// Signal for the new PeerConnection
	signalPeerConnections()

	message := &websocketMessage{}
	for {
		_, raw, err := c.ReadMessage()
		if err != nil {
			log.Errorf("Failed to read message: %v", err)

			return
		}

		if err := json.Unmarshal(raw, &message); err != nil {
			log.Errorf("Failed to unmarshal json to message: %v", err)

			return
		}

		switch message.Event {
		case "candidate":
			candidate := webrtc.ICECandidateInit{}
			if err := json.Unmarshal(message.Data, &candidate); err != nil {
				log.Errorf("Failed to unmarshal json to candidate: %v", err)

				return
			}

			if err := peerConnection.AddICECandidate(candidate); err != nil {
				log.Errorf("Failed to add ICE candidate: %v", err)

				return
			}
		case "answer":
			answer := webrtc.SessionDescription{}
			if err := json.Unmarshal(message.Data, &answer); err != nil {
				log.Errorf("Failed to unmarshal json to answer: %v", err)

				return
			}

			if err := peerConnection.SetRemoteDescription(answer); err != nil {
				log.Errorf("Failed to set remote description: %v", err)

				return
			}
			listLock.Lock()
			state.signalsCount -= 1
			isNeedSignaling := state.signalsCount > 0
			listLock.Unlock()
			if isNeedSignaling {
				signalPeerConnections()
			}
		default:
			log.Errorf("unknown message: %+v", message)
		}
	}
}

// Helper to make Gorilla Websockets threadsafe.
type threadSafeWriter struct {
	*websocket.Conn
	sync.Mutex
}

func (t *threadSafeWriter) WriteJSON(event string, v interface{}) error {
	t.Lock()
	defer t.Unlock()

	return t.Conn.WriteJSON(struct {
		Event string `json:"event"`
		Data  any    `json:"data"`
	}{event, v})
}

const html = ""

func indexHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html")
	fmt.Fprint(w, html)
}

type Server struct {
}

var disabledXPoweredBy = false
var xPoweredByValue = "yohimik"

func init() {
	disable, _ := os.LookupEnv("DISABLE_X_POWERED_BY")
	if disable == "true" {
		disabledXPoweredBy = true
	}
	xPoweredValue, has := os.LookupEnv("X_POWERED_BY_VALUE")
	if has {
		xPoweredByValue = xPoweredValue
	}
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if !disabledXPoweredBy {
		w.Header().Set("X-Powered-By", xPoweredByValue)
	}
	switch r.URL.Path {
	case "/websocket":
		websocketHandler(w, r)
	default:
		p := r.URL.Path
		if r.URL.Path == "/" {
			p = "index.html"
		}
		path := filepath.Join("public", p)
		if _, err := os.Stat(path); os.IsNotExist(err) {
			http.NotFound(w, r)
			return
		}
		http.ServeFile(w, r, path)
	}
}

func runSFU() {
	settingEngine := webrtc.SettingEngine{}
	settingEngine.DetachDataChannels()

	port, ok := os.LookupEnv("PORT")
	if ok {
		p, err := strconv.Atoi(port)
		if err == nil {
			udpMux, err := ice.NewMultiUDPMuxFromPort(p)
			if err != nil {
				panic(err)
			}
			settingEngine.SetICEUDPMux(udpMux)
		}
	}

	ip, ok := os.LookupEnv("IP")
	if ok {
		settingEngine.SetNAT1To1IPs([]string{ip}, webrtc.ICECandidateTypeHost)
	}

	m := &webrtc.MediaEngine{}
	err := m.RegisterDefaultCodecs()
	if err != nil {
		panic(err)
	}

	i := &interceptor.Registry{}
	err = webrtc.RegisterDefaultInterceptors(m, i)
	if err != nil {
		panic(err)
	}
	api = webrtc.NewAPI(webrtc.WithSettingEngine(settingEngine), webrtc.WithMediaEngine(m), webrtc.WithInterceptorRegistry(i))

	// Init other state
	trackLocals = map[string]*webrtc.TrackLocalStaticRTP{}

	// request a keyframe every 3 seconds
	go func() {
		for range time.NewTicker(time.Second * 3).C {
			dispatchKeyFrame()
		}
	}()

	// start HTTP server
	if err := http.ListenAndServe(addr, &Server{}); err != nil { //nolint: gosec
		log.Errorf("Failed to start http server: %v", err)
	}
}
