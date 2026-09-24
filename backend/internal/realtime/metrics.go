package realtime

import (
	"github.com/coder/websocket"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	wsConnections = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "ws_connections",
		Help: "Open WebSocket connections on this instance.",
	})
	wsClosed = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "ws_closed_total",
		Help: "WebSocket connections closed by the server, by reason.",
	}, []string{"reason"})
)

func closeReason(code websocket.StatusCode) string {
	switch code {
	case websocket.StatusNormalClosure:
		return "client_left"
	case websocket.StatusServiceRestart:
		return "shutdown"
	case StatusSessionRevoked:
		return "session_revoked"
	case websocket.StatusPolicyViolation:
		return "policy"
	default:
		return "error"
	}
}
