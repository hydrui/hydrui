package options

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"fmt"
	"math/big"
	"net"
	"sync"
	"time"
)

// Make certificates valid for approx. 10 years, just to be safe.
const selfSignedCertValidFor = time.Hour * 24 * 365 * 10

type SelfSignedCertManager struct {
	certCache sync.Map
}

// GetCertificate implements the [tls.Config] GetCertificate method but
// generates and caches (in-memory only) a self-signed certificate.
// This is mainly intended for convenience when testing. This is pretty much
// useless for any real use case since you would constantly have to create
// exceptions whenever the program restarts.
func (m *SelfSignedCertManager) GetCertificate(i *tls.ClientHelloInfo) (*tls.Certificate, error) {
	host := i.ServerName
	if host == "" {
		host = "localhost"
	}
	if cert, ok := m.certCache.Load(host); ok {
		return cert.(*tls.Certificate), nil
	}
	serialNumberLimit := new(big.Int).Lsh(big.NewInt(1), 128)
	serialNumber, err := rand.Int(rand.Reader, serialNumberLimit)
	if err != nil {
		return nil, fmt.Errorf("failed to generate serial number: %w", err)
	}
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return nil, fmt.Errorf("failed to generate private key: %w", err)
	}
	template := x509.Certificate{
		BasicConstraintsValid: true,

		SerialNumber: serialNumber,
		Subject: pkix.Name{
			Organization: []string{"Hydrui Self-Signed"},
		},
		NotBefore:   time.Now(),
		NotAfter:    time.Now().Add(selfSignedCertValidFor),
		KeyUsage:    x509.KeyUsageDigitalSignature | x509.KeyUsageKeyEncipherment,
		ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
	}
	if ip := net.ParseIP(host); ip != nil {
		template.IPAddresses = append(template.IPAddresses, ip)
	} else {
		template.DNSNames = append(template.DNSNames, host)
	}
	derBytes, err := x509.CreateCertificate(rand.Reader, &template, &template, priv.Public(), priv)
	if err != nil {
		return nil, fmt.Errorf("failed to create certificate: %w", err)
	}
	cert := &tls.Certificate{
		Certificate: [][]byte{derBytes},
		PrivateKey:  priv,
	}
	// If we wind up racing, always return the cached cert.
	actual, _ := m.certCache.LoadOrStore(host, cert)
	return actual.(*tls.Certificate), nil
}

// TLSConfig returns a TLS configuration that automatically generates
// self-signed certificates and supports HTTP/2.
func (m *SelfSignedCertManager) TLSConfig() *tls.Config {
	return &tls.Config{
		GetCertificate: m.GetCertificate,
		NextProtos: []string{
			"h2", "http/1.1",
		},
	}
}
