package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"

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
	reportFpathsBuf, err := json.Marshal(reportFpaths)
	if err != nil {
		return merry.Wrap(err)
	}

	htmlBuf, err := ioutil.ReadFile(exPath + "/www/index.html")
	if err != nil {
		return merry.Wrap(err)
	}
	cssBuf, err := ioutil.ReadFile(exPath + "/www/index.css")
	if err != nil {
		return merry.Wrap(err)
	}
	jsBuf, err := ioutil.ReadFile(exPath + "/www/index.js")
	if err != nil {
		return merry.Wrap(err)
	}
	html := string(htmlBuf)
	html = strings.Replace(html, "/* CSS_CONTENT */", string(cssBuf), 1)
	html = strings.Replace(html, "/* JS_CONTENT */", strings.ReplaceAll(string(jsBuf), "+", "%2B"), 1)
	html = strings.Replace(html, "/* DATA_CONTENT */", `{"reportFpaths":`+string(reportFpathsBuf)+`}`, 1)

	debug := true
	w := webview.New(debug)
	defer w.Destroy()
	w.SetTitle("Minimal webview example")
	w.SetSize(800, 600, webview.Hint(webview.HintNone))
	w.Navigate("data:text/html," + html)
	w.Bind("internal_loadReportData", func(fpath string) (string, error) {
		fmt.Println("loading report " + fpath)
		buf, err := ioutil.ReadFile(fpath)
		if err != nil {
			return "", merry.Wrap(err)
		}
		return string(buf), nil
	})
	w.Run()

	return nil
}

func main() {
	if err := showWebView(); err != nil {
		panic(merry.Details(err))
	}
}
