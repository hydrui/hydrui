package options

import (
	"flag"
	"fmt"
	"os"
)

var (
	_ flag.Getter = (*secretLiteralValue)(nil)
	_ flag.Getter = secretFileValue{}
)

// SecretVar defines two string flags: one with the specified name, default value, and
// the specified usage string with "String containing " prepended to it, and one with
// the specified name with "-file" appended to it, no default value, and the specified
// usage string with "Path to file containing " prepended to it. The former string flag
// will be treated as a string literal value, and the latter string flag value will be
// treated as a path to a file to use for the secret contents. The String() function on
// the first flag will return "*REDACTED*" if the value is non-empty, whereas it will
// return an empty string always for the latter flag.
func SecretVar(f *flag.FlagSet, p *string, name string, value string, usage string) {
	s := newSecretValue(value, p)
	f.Var(s, name, "String containing "+usage)
	f.Var(secretFileValue{s}, name+"-file", "Path to file containing "+usage)
}

// Secret defines two string flags: one with the specified name, default value, and the
// specified usage string with "String containing " prepended to it, and one with the
// specified name with "-file" appended to it, no default value, and the specified usage
// string with "Path to file containing " prepended to it. The former string flag will be
// treated as a string literal value, and the latter string flag value will be treated as
// a path to a file to use for the secret contents. The String() function on the first
// flag will return "*REDACTED*" if the value is non-empty, whereas it will return an
// empty string always for the latter flag. The return value is the address of a string
// variable that stores the value of the flag.
func Secret(f *flag.FlagSet, name string, value string, usage string) *string {
	p := new(string)
	SecretVar(f, p, name, value, usage)
	return p
}

type secretLiteralValue string

func newSecretValue(val string, p *string) *secretLiteralValue {
	*p = val
	return (*secretLiteralValue)(p)
}

func (s *secretLiteralValue) Set(val string) error {
	*s = secretLiteralValue(val)
	return nil
}

func (s *secretLiteralValue) Get() any { return string(*s) }

func (s *secretLiteralValue) String() string {
	if s == nil || *s == "" {
		return ""
	}
	return "*REDACTED*"
}

type secretFileValue struct {
	*secretLiteralValue
}

func (s secretFileValue) Set(filename string) error {
	val, err := os.ReadFile(filename)
	if err != nil {
		return fmt.Errorf("failed to read secret file %q: %w", filename, err)
	}
	return s.secretLiteralValue.Set(string(val))
}

func (s secretFileValue) String() string {
	return ""
}
