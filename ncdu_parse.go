package main

import (
	"encoding/json"
	"io/ioutil"
	_ "net/http/pprof"
	"strconv"

	"github.com/ansel1/merry"
)

type NcduEntry interface {
	File() *NcduFileEntry
	Children() []NcduEntry
}

type NcduMetadata struct {
	Progname  string `json:"progname"`
	Progver   string `json:"progver"`
	Timestamp int64  `json:"timestamp"`
}

type NcduFileEntry struct {
	Name      string `json:"name"`
	Asize     int64  `json:"asize"`
	Dsize     int64  `json:"dsize"`
	Dev       int64  `json:"dev"`
	Ino       int64  `json:"ino"`
	Notreg    bool   `json:"notreg"`
	Hlnkc     bool   `json:"hlnkc"`
	ReadError bool   `json:"read_error"`
}

func (e *NcduFileEntry) File() *NcduFileEntry {
	return e
}

func (e *NcduFileEntry) Children() []NcduEntry {
	return nil
}

type NcduDirEntry struct {
	FileInner     *NcduFileEntry
	ChildrenInner []NcduEntry
}

func (e *NcduDirEntry) File() *NcduFileEntry {
	return e.FileInner
}

func (e *NcduDirEntry) Children() []NcduEntry {
	return e.ChildrenInner
}

type NcduReport struct {
	Minorver int64
	Majorver int64
	Metadata *NcduMetadata
	Root     NcduEntry
}

func NcduParseGroup(buf []byte, curDev int64) (NcduEntry, error) {
	if buf[0] == '[' {
		var rawEntries []JsonRawSliceMessage
		if err := json.Unmarshal(buf, &rawEntries); err != nil {
			return nil, merry.Wrap(err)
		}
		dir := &NcduDirEntry{ChildrenInner: make([]NcduEntry, len(rawEntries)-1)}
		for i, raw := range rawEntries {
			var ent NcduEntry
			ent, err := NcduParseGroup(raw, curDev)
			if err != nil {
				return nil, merry.Wrap(err)
			}
			if i == 0 {
				if head, ok := ent.(*NcduFileEntry); ok {
					dir.FileInner = head
					curDev = head.Dev
				} else {
					return nil, merry.Errorf("expected file as directory head, got %T", head)
				}
			} else {
				dir.ChildrenInner[i-1] = ent
			}
		}
		return dir, nil
	} else {
		file := &NcduFileEntry{}
		if err := json.Unmarshal(buf, file); err != nil {
			return nil, merry.Wrap(err)
		}
		if file.Dev == 0 {
			file.Dev = curDev //This field may be absent, in which case it is equivalent to that of the parent directory
		}
		return file, nil
	}
}

func NcduPrase(buf []byte) (*NcduReport, error) {
	var data []JsonRawSliceMessage
	if err := json.Unmarshal(buf, &data); err != nil {
		return nil, merry.Wrap(err)
	}
	if len(data) != 4 {
		return nil, merry.Errorf(`wrong NCDU data: expected 4-element array an top level, got %d element(s)`, len(data))
	}

	majorverStr := string(data[0])
	minorverStr := string(data[0])
	formatVersion := majorverStr + "." + minorverStr
	if formatVersion != "1.1" {
		println("WARN: expected format version 1.1, got " + formatVersion)
	}
	majorver, err := strconv.ParseInt(majorverStr, 10, 64)
	if err != nil {
		return nil, merry.Wrap(err)
	}
	minorver, err := strconv.ParseInt(minorverStr, 10, 64)
	if err != nil {
		return nil, merry.Wrap(err)
	}

	var meta *NcduMetadata
	if err := json.Unmarshal(data[2], &meta); err != nil {
		return nil, merry.Wrap(err)
	}
	root, err := NcduParseGroup(data[3], 0)
	if err != nil {
		return nil, merry.Wrap(err)
	}
	return &NcduReport{Majorver: majorver, Minorver: minorver, Metadata: meta, Root: root}, nil
}

func NcduPraseFile(fpath string) (*NcduReport, error) {
	buf, err := ioutil.ReadFile(fpath)
	if err != nil {
		return nil, merry.Wrap(err)
	}
	return NcduPrase(buf)
}
