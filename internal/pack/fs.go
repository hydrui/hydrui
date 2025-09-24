package pack

import (
	"errors"
	"io"
	"io/fs"
	"slices"
	"strings"
	"time"
)

// Open implements the fs.FS interface
func (pack *Pack) Open(name string) (fs.File, error) {
	if data, ok := pack.Files[name]; ok {
		return &openFile{
			f: &file{
				name: name,
				data: data,
			},
		}, nil
	}
	subDirs := []fs.DirEntry{}
	subFiles := []fs.DirEntry{}
	dirPath := name
	if !strings.HasSuffix(dirPath, "/") {
		dirPath += "/"
	}
	dirPathLen := len(dirPath)
	nameSet := make(map[string]struct{})
	for path, data := range pack.Files {
		if strings.HasPrefix(path, dirPath) {
			subPath := path[dirPathLen:]
			subName, _, isDir := strings.Cut(subPath, "/")
			if _, ok := nameSet[subName]; ok {
				continue
			}
			nameSet[subName] = struct{}{}
			if isDir {
				subDirs = append(subDirs, &dir{name: subName})
			} else {
				subFiles = append(subFiles, &file{name: subName, data: data})
			}
		}
	}
	entries := slices.Concat(subDirs, subFiles)
	if len(entries) == 0 {
		return nil, &fs.PathError{Op: "open", Path: name, Err: fs.ErrNotExist}
	}
	return &openDir{
		d: &dir{
			name: dirPath,
		},
		name:    dirPath,
		entries: entries,
	}, nil
}

type file struct {
	name string
	data []byte
}

func (f *file) Name() string               { return f.name }
func (f *file) Size() int64                { return int64(len(f.data)) }
func (f *file) IsDir() bool                { return false }
func (f *file) Type() fs.FileMode          { return 0 }
func (f *file) Mode() fs.FileMode          { return 0 }
func (f *file) ModTime() time.Time         { return time.Time{} }
func (f *file) Sys() any                   { return nil }
func (f *file) Info() (fs.FileInfo, error) { return f, nil }

type openFile struct {
	f      *file
	offset int64
}

func (f *openFile) Close() error               { return nil }
func (f *openFile) Stat() (fs.FileInfo, error) { return f.f, nil }
func (f *openFile) Read(b []byte) (int, error) {
	if f.offset >= int64(len(f.f.data)) {
		return 0, io.EOF
	}
	if f.offset < 0 {
		return 0, &fs.PathError{Op: "read", Path: f.f.name, Err: fs.ErrInvalid}
	}
	n := copy(b, f.f.data[f.offset:])
	f.offset += int64(n)
	return n, nil
}
func (f *openFile) Seek(offset int64, whence int) (int64, error) {
	switch whence {
	case 1:
		offset += f.offset
	case 2:
		offset += int64(len(f.f.data))
	}
	if offset < 0 || offset > int64(len(f.f.data)) {
		return 0, &fs.PathError{Op: "seek", Path: f.f.name, Err: fs.ErrInvalid}
	}
	f.offset = offset
	return offset, nil
}

type dir struct {
	name string
}

func (f *dir) Name() string               { return f.name }
func (f *dir) Size() int64                { return 0 }
func (f *dir) IsDir() bool                { return false }
func (f *dir) Type() fs.FileMode          { return fs.ModeDir }
func (f *dir) Mode() fs.FileMode          { return fs.ModeDir }
func (f *dir) ModTime() time.Time         { return time.Time{} }
func (f *dir) Sys() any                   { return nil }
func (f *dir) Info() (fs.FileInfo, error) { return f, nil }

type openDir struct {
	name    string
	d       *dir
	entries []fs.DirEntry
	offset  int
}

func (d *openDir) Close() error               { return nil }
func (d *openDir) Stat() (fs.FileInfo, error) { return d.d, nil }
func (d *openDir) Read([]byte) (int, error) {
	return 0, &fs.PathError{Op: "read", Path: d.name, Err: errors.New("is a directory")}
}
func (d *openDir) ReadDir(count int) ([]fs.DirEntry, error) {
	n := len(d.entries) - d.offset
	if n == 0 {
		if count <= 0 {
			return nil, nil
		}
		return nil, io.EOF
	}
	if count > 0 && n > count {
		n = count
	}
	list := make([]fs.DirEntry, n)
	copy(list, d.entries[d.offset:])
	d.offset += n
	return list, nil
}
