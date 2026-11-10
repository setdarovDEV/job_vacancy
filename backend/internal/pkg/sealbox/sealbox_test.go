package sealbox

import (
	"bytes"
	"testing"
)

func TestSealOpen(t *testing.T) {
	master := bytes.Repeat([]byte("k"), 32)
	b, err := New(master, "totp")
	if err != nil {
		t.Fatal(err)
	}
	s1, _ := b.Seal([]byte("secret"))
	s2, _ := b.Seal([]byte("secret"))
	if bytes.Equal(s1, s2) {
		t.Fatal("nonce must differ")
	}
	if p, err := b.Open(s1); err != nil || string(p) != "secret" {
		t.Fatal(err)
	}
	other, _ := New(master, "other")
	if _, err := other.Open(s1); err == nil {
		t.Fatal("a different purpose must not decrypt")
	}
	s1[len(s1)-1] ^= 1
	if _, err := b.Open(s1); err == nil {
		t.Fatal("tampering must be detected")
	}
	if _, err := New([]byte("short"), "x"); err == nil {
		t.Fatal("short master accepted")
	}
}
