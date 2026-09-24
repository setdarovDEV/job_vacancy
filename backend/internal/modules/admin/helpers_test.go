package admin_test

import (
	"net/netip"
	"time"
)

func mustAddr(s string) netip.Addr { return netip.MustParseAddr(s) }

func mustZone(name string) *time.Location {
	loc, err := time.LoadLocation(name)
	if err != nil {
		return time.FixedZone("UZT", 5*3600)
	}
	return loc
}
