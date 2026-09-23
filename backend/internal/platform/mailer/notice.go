package mailer

import (
	"bytes"
	_ "embed"
	"html/template"
)

//go:embed templates/notice.html
var noticeHTML string

var noticeTmpl = template.Must(template.New("notice").Parse(noticeHTML))

// Notice is a generic notification e-mail: a title, a short body and one button.
type Notice struct {
	Locale, To, Title, Body, Button, URL, Footer string
}

func RenderNotice(n Notice) (Message, error) {
	var html bytes.Buffer
	err := noticeTmpl.Execute(&html, map[string]string{
		"Lang": n.Locale, "Title": n.Title, "Body": n.Body, "Button": n.Button, "URL": n.URL, "Footer": n.Footer,
	})
	if err != nil {
		return Message{}, err
	}
	text := n.Title + "\n\n" + n.Body + "\n"
	if n.URL != "" {
		text += "\n" + n.Button + ": " + n.URL + "\n"
	}
	text += "\n— " + n.Footer + "\n"
	return Message{To: n.To, Subject: n.Title, HTML: html.String(), Text: text}, nil
}
