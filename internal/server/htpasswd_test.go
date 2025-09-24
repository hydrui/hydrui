package server

import (
	"strings"
	"testing"
)

func TestLoadHtpasswdFile(t *testing.T) {
	t.Parallel()

	testData := `# Test htpasswd file
admin:$2y$05$c4WoMPo3SXsafkva.HHa6uXQZWr7oboPiC2bT/r7q1BB8I2s0BRqC
user:{SHA}VBPuJHI7uixaa6LQGWx4s+5GKNE=
invalid-line
`

	// Test loading the file
	htpasswd, err := LoadHtpasswdFile(strings.NewReader(testData))
	if err != nil {
		t.Fatalf("LoadHtpasswdFile failed: %v", err)
	}

	// Check that the correct number of users were loaded
	if len(htpasswd.Users) != 2 {
		t.Errorf("Expected 2 users, got %d", len(htpasswd.Users))
	}

	// Check that the users were loaded correctly
	if user, exists := htpasswd.Users["admin"]; !exists {
		t.Error("Expected admin user to exist")
	} else if user.HashType != HashTypeBcrypt {
		t.Errorf("Expected admin hash type to be bcrypt, got %s", user.HashType)
	}

	if user, exists := htpasswd.Users["user"]; !exists {
		t.Error("Expected user to exist")
	} else if user.HashType != HashTypeSHA1 {
		t.Errorf("Expected user hash type to be sha1, got %s", user.HashType)
	}
}

func TestAuthenticate(t *testing.T) {
	t.Parallel()

	// Create a test htpasswd file
	htpasswd := &HtpasswdFile{
		Users: map[string]User{
			"admin": {
				Username: "admin",
				Hash:     "$2y$05$c4WoMPo3SXsafkva.HHa6uXQZWr7oboPiC2bT/r7q1BB8I2s0BRqC",
				HashType: HashTypeBcrypt,
			},
			"sha1user": {
				Username: "sha1user",
				Hash:     "VBPuJHI7uixaa6LQGWx4s+5GKNE=",
				HashType: HashTypeSHA1,
			},
			"invalid": {
				Username: "invalid",
				Hash:     "invalid",
				HashType: HashTypeUnknown,
			},
		},
	}

	// Test cases
	testCases := []struct {
		name          string
		username      string
		password      string
		expectedAuth  bool
		expectedError bool
	}{
		{"Valid bcrypt", "admin", "myPassword", true, false},
		{"Invalid bcrypt password", "admin", "wrong", false, false},
		{"Valid SHA1", "sha1user", "myPassword", true, false},
		{"Invalid SHA1 password", "sha1user", "wrong", false, false},
		{"Non-existent user", "nonexistent", "password", false, false},
		{"Invalid hash type", "invalid", "password", false, true},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			authenticated, err := htpasswd.Authenticate(tc.username, tc.password)

			// Check authentication result
			if authenticated != tc.expectedAuth {
				t.Errorf("Expected authentication to be %v, got %v", tc.expectedAuth, authenticated)
			}

			// Check error result
			if (err != nil) != tc.expectedError {
				t.Errorf("Expected error to be %v, got %v", tc.expectedError, err != nil)
			}
		})
	}
}
