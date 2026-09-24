// Package isbot recognises crawlers, link previewers, monitors and HTTP libraries by
// their User-Agent, so they don't inflate vacancy view counts (TZ BE-10).
//
// It is a substring list in the spirit of the "isbot" npm package, trimmed to what
// actually requests pages: search engines, social/messenger link previews, SEO tools,
// uptime monitors, headless browsers and scripting clients. Real browsers, in-app
// browsers and the mobile app (Dart) never contain these tokens. The web's SSR server
// fetches with User-Agent "node", which is not a bot: it asks on behalf of a visitor.
package isbot

import "strings"

// tokens are matched against the lower-cased User-Agent.
var tokens = []string{
	// generic
	"bot", "crawl", "spider", "slurp", "scrape", "archiver", "indexer", "fetcher",
	// search engines not covered by "bot" (every Yandex robot links yandex.com/bots; the
	// Yandex app's browser says "YandexSearch", so "yandex" alone would hit people)
	"baiduspider", "mediapartners-google", "google-inspectiontool",
	"googleother", "google-read-aloud", "storebot-google", "feedfetcher",
	// link previews
	// (TelegramBot, Discordbot, Pinterestbot… match "bot"; the Telegram, Viber and Pinterest
	// in-app browsers add their app name to a real browser UA, so those names aren't listed)
	"facebookexternalhit", "facebookcatalog", "meta-externalagent", "whatsapp/",
	"skypeuripreview", "vkshare", "embedly", "quora link preview", "outbrain", "iframely",
	"preview",
	// SEO, monitoring, performance tools
	"lighthouse", "pagespeed", "chrome-lighthouse", "gtmetrix", "pingdom", "uptime",
	"statuscake", "site24x7", "newrelic", "datadog", "monitor", "check_http", "semrush",
	"ahrefs", "mj12", "dotbot", "petalbot", "bytespider", "gptbot", "chatgpt", "claude",
	"perplexity", "ccbot", "anthropic",
	// headless browsers and automation
	"headless", "phantomjs", "puppeteer", "playwright", "selenium", "webdriver",
	// scripting clients
	"curl/", "wget/", "python-requests", "python-urllib", "aiohttp", "httpx", "go-http-client",
	"java/", "apache-httpclient", "libwww", "lwp::", "httpunit", "node-fetch",
	"axios/", "got (", "undici", "postmanruntime", "insomnia", "http_request2", "guzzlehttp",
	"scrapy", "colly", "k6/", "apachebench", "hey/", "jmeter", "gatling",
}

// Match reports whether a User-Agent belongs to a bot or a non-browser client. An empty
// User-Agent counts as a bot: every browser sends one.
func Match(userAgent string) bool {
	ua := strings.ToLower(strings.TrimSpace(userAgent))
	if ua == "" {
		return true
	}
	for _, t := range tokens {
		if strings.Contains(ua, t) {
			return true
		}
	}
	return false
}
