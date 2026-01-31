package main

import (
	"io"

	goxash3d_fwgs "github.com/yohimik/goxash3d-fwgs/pkg"
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
