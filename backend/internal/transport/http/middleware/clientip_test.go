package middleware

import "testing"

func TestClientAddr(t *testing.T) {
	cases := []struct {
		name   string
		remote string
		xff    []string
		trust  bool
		want   string
	}{
		{"browser via Caddy (docker-proxy peer)", "172.20.0.1:5123", []string{"84.54.70.10"}, true, "84.54.70.10"},
		{"SSR via web container forwarding Caddy's header", "172.20.0.7:40000", []string{"84.54.70.10"}, true, "84.54.70.10"},
		{"client-injected entry is left of the real hop", "172.20.0.1:5123", []string{"1.2.3.4, 84.54.70.10"}, true, "84.54.70.10"},
		{"internal hops on the right are skipped", "10.0.0.5:1", []string{"84.54.70.10, 172.20.0.1", "10.0.0.2"}, true, "84.54.70.10"},
		{"spoofed header from a public peer is ignored", "203.0.113.9:443", []string{"1.2.3.4"}, true, "203.0.113.9"},
		{"proxy headers ignored when not behind a proxy", "172.20.0.1:5123", []string{"84.54.70.10"}, false, "172.20.0.1"},
		{"fully internal chain keeps the original sender", "127.0.0.1:9000", []string{"192.168.1.20, 127.0.0.1"}, true, "192.168.1.20"},
		{"no header: the peer", "127.0.0.1:9000", nil, true, "127.0.0.1"},
		{"garbage header falls back to the peer", "172.20.0.1:5123", []string{"not-an-ip"}, true, "172.20.0.1"},
		{"IPv4-mapped IPv6 peer", "[::ffff:172.20.0.1]:80", []string{"2001:db8::1"}, true, "2001:db8::1"},
	}
	for _, c := range cases {
		if got := clientAddr(c.remote, c.xff, c.trust).String(); got != c.want {
			t.Errorf("%s: got %s, want %s", c.name, got, c.want)
		}
	}
}
