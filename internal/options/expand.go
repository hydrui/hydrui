package options

import "os"

func expand(s string, mapping func(string) (string, bool)) string {
	var result []byte
	for i := 0; i < len(s); {
		if s[i] == '$' {
			dollarCount := 0
			j := i
			for j < len(s) && s[j] == '$' {
				dollarCount++
				j++
			}
			if dollarCount > 1 {
				for k := 0; k < dollarCount-1; k++ {
					result = append(result, '$')
				}
				i = j
				continue
			}
			if j < len(s) {
				var varName string
				var endPos int
				if s[j] == '{' {
					closePos := j + 1
					for closePos < len(s) && s[closePos] != '}' {
						closePos++
					}
					if closePos < len(s) {
						varName = s[j+1 : closePos]
						endPos = closePos + 1
					} else {
						result = append(result, '$')
						i++
						continue
					}
				} else {
					endPos = j
					for endPos < len(s) && isIdentifier(s[endPos]) {
						endPos++
					}
					varName = s[j:endPos]
				}
				if varName != "" {
					if value, ok := mapping(varName); ok {
						result = append(result, value...)
						i = endPos
						continue
					}
				}
			}
			result = append(result, '$')
			i++
		} else {
			result = append(result, s[i])
			i++
		}
	}
	return string(result)
}

func expandEnv(s string) string {
	return expand(s, os.LookupEnv)
}

func isIdentifier(c byte) bool {
	return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_'
}
