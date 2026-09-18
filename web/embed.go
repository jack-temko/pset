// Package web embeds the built SPA from web/dist so the API adapter can
// serve it from the binary. The dist directory ships with only a .gitkeep;
// build the frontend first (see web/README.md) to serve the real app.
package web

import "embed"

//go:embed all:dist
var Dist embed.FS
