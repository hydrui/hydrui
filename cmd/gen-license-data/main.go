package main

import (
	"encoding/csv"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"maps"
	"net/url"
	"os"
	"os/exec"
	"slices"
	"strings"
)

func main() {
	flag.Parse()
	outfile := io.Writer(os.Stdout)
	if flag.NArg() > 0 {
		writers := []io.Writer{}
		for i := range flag.NArg() {
			filename := flag.Arg(i)
			f, err := os.Create(filename)
			if err != nil {
				log.Fatal(err)
			}
			defer func() {
				if err := f.Close(); err != nil {
					log.Fatalf("Error closing output file: %v", err)
				}
				if err := exec.Command("npx", "prettier", "--write", filename).Run(); err != nil {
					log.Fatalf("Error formatting output file: %v", err)
				}
			}()
			writers = append(writers, f)
		}
		outfile = io.MultiWriter(writers...)
	}
	cmd := exec.Command(
		"npx",
		"license-checker-rseidelsohn",
		"--json",
		"--excludePrivatePackages",
		"--relativeLicensePath",
	)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		log.Fatal(err)
	}
	if err := cmd.Start(); err != nil {
		log.Fatal(err)
	}
	type npmpackage struct {
		Name        string
		Version     string
		Licenses    string
		Repository  string
		Publisher   string
		Email       string
		URL         string
		Path        string
		LicenseFile string
	}
	npmPackageMap := map[string]npmpackage{}
	if err := json.NewDecoder(stdout).Decode(&npmPackageMap); err != nil {
		log.Fatal(err)
	}
	npmPackages := []npmpackage{}
	for _, pname := range slices.Sorted(maps.Keys(npmPackageMap)) {
		pkg := npmPackageMap[pname]
		name, ver, _ := strings.Cut(pname[1:], "@")
		pkg.Name = string(pname[0]) + name
		pkg.Version = ver
		npmPackages = append(npmPackages, pkg)
	}
	if err := cmd.Wait(); err != nil {
		log.Fatal(err)
	}
	cmd = exec.Command(
		"go",
		"run",
		"github.com/google/go-licenses@latest",
		"report",
		"--ignore",
		"github.com/hydrui",
		"./...",
	)
	stdout, err = cmd.StdoutPipe()
	if err != nil {
		log.Fatal(err)
	}
	if err := cmd.Start(); err != nil {
		log.Fatal(err)
	}
	type gopackage struct {
		URL        string
		LicenseURL string
		License    string
	}
	goPackages := []gopackage{}
	csvReader := csv.NewReader(stdout)
	for {
		record, err := csvReader.Read()
		if err != nil {
			if errors.Is(err, io.EOF) {
				break
			}
			log.Fatal(err)
		}
		if len(record) != 3 {
			log.Fatalf("Unexpected column count %d in %v", len(record), record)
		}
		goPackages = append(goPackages, gopackage{
			URL:        record[0],
			LicenseURL: record[1],
			License:    record[2],
		})
	}
	if err := cmd.Wait(); err != nil {
		log.Fatal(err)
	}
	if _, err := fmt.Fprint(outfile, `<h1>Third Party Licenses</h1>
<p>
Hydrui has a number of build and runtime dependencies with different open source
licenses. This list is intended to be a complete list of all software that may
be included in the final Hydrui builds. Please be aware that while most packages
listed here are <i>not</i> included in the final build, and only referenced at
build-time, not all build-time dependencies are listed here.
</p>
<p>
We are grateful for all the open source projects that have provided us powerful
tools to build with. Hydrui is not affiliated with or endorsed by any of the
following projects or developers.
</p>
<h2>Hydrui Client/Website (NPM)</h2><ul>
`); err != nil {
		log.Fatal(err)
	}
	for _, pkg := range npmPackages {
		repoURL := pkg.Repository
		licenseURL := repoURL
		licensePath := pkg.LicenseFile
		licensePath, _ = strings.CutPrefix(licensePath, "node_modules/")
		licensePath, _ = strings.CutPrefix(licensePath, pkg.Name)
		licensePath, _ = strings.CutPrefix(licensePath, "/")
		if pkg.Repository != "" {
			uri, err := url.Parse(pkg.Repository)
			if err != nil {
				log.Fatal(err)
			}
			switch uri.Host {
			case "github.com":
				uri.Path += "/blob/HEAD/" + licensePath
				licenseURL = uri.String()
			default:
				log.Fatalf("Unknown repository host %s", uri.Host)
			}
		} else {
			log.Fatalf("No repository for %s?", pkg.Name)
		}
		if _, err := fmt.Fprintf(outfile, `<li><a href="%s">%s %s</a>, <a href="%s">%s</a>`, repoURL, pkg.Name, pkg.Version, licenseURL, pkg.Licenses); err != nil {
			log.Fatal(err)
		}
	}
	if _, err := fmt.Fprint(outfile, "</ul><h2> Hydrui Server (Go)</h2><ul>"); err != nil {
		log.Fatal(err)
	}
	for _, pkg := range goPackages {
		if _, err := fmt.Fprintf(outfile, `<li><a href="%s">%s</a>, <a href="%s">%s</a>`, "https://"+pkg.URL, pkg.URL, pkg.LicenseURL, pkg.License); err != nil {
			log.Fatal(err)
		}
	}
	if _, err := fmt.Fprintf(outfile, "</ul>"); err != nil {
		log.Fatal(err)
	}
}
