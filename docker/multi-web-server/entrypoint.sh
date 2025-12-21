#!/bin/bash
set -e

# Default values
XASH_GAME_TYPE="${GAME_TYPE:-hlsdk}"
XASH_MAP="${MAP:-crossfire}"
XASH_MAXPLAYERS="${MAXPLAYERS:-16}"

# Build the command
CMD="./xash +ip 0.0.0.0 -port 27015"

# Add -game parameter based on GAME_TYPE
if [ "$XASH_GAME_TYPE" = "cstrike" ]; then
    CMD="$CMD -game cstrike"
    # Default map for Counter-Strike
    [ -z "$XASH_MAP" ] && XASH_MAP="de_dust2"
elif [ "$XASH_GAME_TYPE" = "hlsdk" ]; then
    # Half-Life doesn't need -game parameter
    # Default map for Half-Life
    [ -z "$XASH_MAP" ] && XASH_MAP="crossfire"
else
    # Other mods
    CMD="$CMD -game $XASH_GAME_TYPE"
    [ -z "$XASH_MAP" ] && XASH_MAP="crossfire"
fi

# Append any additional arguments passed to the container
if [ $# -gt 0 ]; then
    CMD="$CMD $@"
else
    # Default parameters if none provided
    CMD="$CMD +map ${XASH_MAP} +maxplayers ${XASH_MAXPLAYERS}"
fi

echo "Starting Xash3D with: $CMD"
exec $CMD
