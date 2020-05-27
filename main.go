package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/ansel1/merry"
	"github.com/zserge/webview"
)

func addReportFilesFromDir(dirpath string, res *[]string) error {
	err := filepath.Walk(dirpath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return merry.Wrap(err)
		}
		if !info.IsDir() && strings.HasSuffix(path, ".json") {
			*res = append(*res, path)
		}
		return nil
	})
	return merry.Wrap(err)
}

func findReportFiles() ([]string, error) {
	var err error
	res := make([]string, 0)
	for _, fpath := range os.Args[1:] {
		fpath, err = filepath.EvalSymlinks(fpath)
		if err != nil {
			return nil, merry.Wrap(err)
		}
		info, err := os.Stat(fpath)
		if err != nil {
			return nil, merry.Wrap(err)
		}
		if info.IsDir() {
			if err := addReportFilesFromDir(fpath, &res); err != nil {
				return nil, merry.Wrap(err)
			}
		} else {
			res = append(res, fpath)
		}
	}
	return res, nil
}

func showWebView() error {
	ex, err := os.Executable()
	if err != nil {
		return merry.Wrap(err)
	}
	exPath := filepath.Dir(ex)

	reportFpaths, err := findReportFiles()
	if err != nil {
		return merry.Wrap(err)
	}
	fmt.Println(reportFpaths)

	// ====
	stt := time.Now()
	rep0, err := NcduPraseFile(reportFpaths[0])
	if err != nil {
		return merry.Wrap(err)
	}
	rep1, err := NcduPraseFile(reportFpaths[1])
	if err != nil {
		return merry.Wrap(err)
	}
	fmt.Println("parsing", time.Now().Sub(stt), rep0, rep1)
	// var diff *DiffReport
	res0 := ReportFromNcdu(reportFpaths[0], rep0)
	res1 := ReportFromNcdu(reportFpaths[1], rep1)
	fmt.Println("converting", time.Now().Sub(stt))
	diff := CalcDiff(res0, res1)
	fmt.Println("diffing", time.Now().Sub(stt))
	// ====

	debug := true
	w := webview.New(debug)
	defer w.Destroy()
	w.SetTitle("Minimal webview example")
	w.SetSize(800, 600, webview.Hint(webview.HintNone))
	w.Navigate("file://" + exPath + "/www/index.html")
	w.Bind("internal_getChildren", func(path []string) ([]DiffNodeCore, error) {
		children := diff.Roots
		for _, part := range path {
			found := false
			for _, child := range children {
				if child.Name() == part {
					children = child.Children
					found = true
					break
				}
			}
			if !found {
				return nil, merry.New("no such file: " + part)
			}
		}
		coreChildren := make([]DiffNodeCore, len(children))
		for i, c := range children {
			coreChildren[i] = c.DiffNodeCore
		}
		b, e := json.Marshal(coreChildren)
		fmt.Println(path, string(b), e)
		return coreChildren, nil
	})
	w.Run()

	return nil
}

func main() {
	go func() {
		log.Println(http.ListenAndServe("localhost:6060", nil))
	}()
	if err := showWebView(); err != nil {
		panic(merry.Details(err))
	}
}

/*
'progname',
'progver',
'timestamp',

'name',
'asize',
'dsize',
'dev',
'ino',
'notreg',
'hlnkc',
'read_error'

https://dev.yorhel.nl/ncdu/jsonfmt

const keys = new Set()
const data = JSON.parse(fs.readFileSync('/home/zblzgamer/Documents/ncdu/report_2020-05-24_11-08__after_cleanup.json').toString('utf-8'))
;(function iter(node) {
	if (Array.isArray(node)) {
		node.forEach(iter)
	} else if (typeof node === 'object') {
		for (const key in node)
			keys.add(key)
	} else {
		console.log(node)
	}
})(data)
*/
