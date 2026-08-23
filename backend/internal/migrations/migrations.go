// Package migrations embeds the SQL schema files so the binary is
// self-contained: no migration tool or loose .sql files needed at deploy time.
package migrations

import "embed"

//go:embed *.sql
var files embed.FS

// FS returns the embedded migration files, applied in lexical filename order.
func FS() embed.FS { return files }
