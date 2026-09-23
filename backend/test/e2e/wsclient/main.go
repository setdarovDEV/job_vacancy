// Command wsclient is a tiny WebSocket client for the e2e scripts: it appends every
// received event as a JSON line to -out, and sends each new line appended to -in.
//
//	wsclient -url ws://localhost:8090/api/v1/ws?ticket=… -out events.jsonl -in frames.jsonl
package main

import (
	"bufio"
	"context"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"time"

	"github.com/coder/websocket"
)

func main() {
	url := flag.String("url", "", "websocket url")
	out := flag.String("out", "", "file to append received events to")
	in := flag.String("in", "", "file whose new lines are sent as frames")
	flag.Parse()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()
	c, resp, err := websocket.Dial(ctx, *url, nil)
	if err != nil {
		code := 0
		if resp != nil {
			code = resp.StatusCode
		}
		fmt.Fprintf(os.Stderr, "dial failed: %d %v\n", code, err)
		os.Exit(2)
	}
	defer c.CloseNow()

	f, err := os.OpenFile(*out, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		panic(err)
	}
	if *in != "" {
		go func() {
			r, err := os.OpenFile(*in, os.O_CREATE|os.O_RDONLY, 0o644)
			if err != nil {
				panic(err)
			}
			br := bufio.NewReader(r)
			for ctx.Err() == nil {
				line, err := br.ReadBytes('\n')
				if err != nil { // no complete line yet: wait for the script to append more
					time.Sleep(50 * time.Millisecond)
					if len(line) > 0 {
						rest, _ := br.ReadBytes('\n')
						line = append(line, rest...)
					} else {
						continue
					}
				}
				_ = c.Write(ctx, websocket.MessageText, line)
			}
		}()
	}
	for {
		_, data, err := c.Read(ctx)
		if err != nil {
			return
		}
		f.Write(append(data, '\n'))
	}
}
