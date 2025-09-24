package options

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestExpand(t *testing.T) {
	t.Parallel()
	mapping := func(v string) (string, bool) {
		switch v {
		case "A":
			return "foo", true
		case "B":
			return "bar", true
		}
		return "", false
	}
	for _, test := range []struct {
		input, output string
	}{
		{"", ""},
		{"$", "$"},
		{"a$a", "a$a"},
		{"$A$B", "foobar"},
		{" $A ", " foo "},
		{" $$A ", " $A "},
		{" $$$A ", " $$A "},
		{" $$$$ ", " $$$ "},
		{" $$ $$ ", " $ $ "},
		{"$A", "foo"},
		{"$B", "bar"},
		{"$A-$B", "foo-bar"},
		{"$A/$B", "foo/bar"},
		{"$A_$B", "$A_bar"},
		{"${A}_${B}", "foo_bar"},
		{"${a}", "${a}"},
		{"foo$", "foo$"},
	} {
		assert.Equal(t, test.output, expand(test.input, mapping))
	}
}
