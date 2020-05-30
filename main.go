package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/ansel1/merry"
	"github.com/zserge/webview"
)

func getDiff(fpath0, fpath1 string, ignorePaths []string) (*DiffReport, error) {
	stt := time.Now()
	rep0, err := NcduPraseFile(fpath0, NcduConfig{IgnorePaths: ignorePaths})
	if err != nil {
		return nil, merry.Wrap(err)
	}
	rep1, err := NcduPraseFile(fpath1, NcduConfig{IgnorePaths: ignorePaths})
	if err != nil {
		return nil, merry.Wrap(err)
	}
	fmt.Println("parsing", time.Now().Sub(stt), rep0, rep1)
	res0 := ReportFromNcdu(fpath0, rep0)
	res1 := ReportFromNcdu(fpath1, rep1)
	fmt.Println("converting", time.Now().Sub(stt))
	diff := CalcDiff(res0, res1)
	fmt.Println("diffing", time.Now().Sub(stt))
	return diff, nil
}

func showWebView(wwwPath string, diff *DiffReport) error {
	debug := true
	w := webview.New(debug)
	defer w.Destroy()
	w.SetTitle("NCDU GUI diff")
	w.SetSize(1280, 960, webview.Hint(webview.HintNone))
	w.Navigate("file://" + wwwPath + "/index.html")
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
		return coreChildren, nil
	})
	w.Run()

	return nil
}

func start() error {
	var ignorePaths StrSliceFlagValue
	flag.Usage = func() {
		fmt.Fprintf(flag.CommandLine.Output(), "Usage: %s [OPTIONS] fileA fileB\n", os.Args[0])
		flag.PrintDefaults()
	}
	flag.Var(&ignorePaths, "ignore", "File/dir path to ignore (can be specified several times)")
	flag.Parse()
	if flag.NArg() != 2 {
		flag.Usage()
		os.Exit(1)
	}

	for i, path := range ignorePaths {
		if strings.HasSuffix(path, "/") {
			ignorePaths[i] = path[:len(path)-1]
		}
	}

	ex, err := os.Executable()
	if err != nil {
		return merry.Wrap(err)
	}
	exPath := filepath.Dir(ex)

	diff, err := getDiff(flag.Arg(0), flag.Arg(1), ignorePaths)
	if err != nil {
		return merry.Wrap(err)
	}

	if err := showWebView(exPath+"/www", diff); err != nil {
		return merry.Wrap(err)
	}
	return nil
}

func main() {
	if err := start(); err != nil {
		panic(merry.Details(err))
	}
}

/*
_ "net/http/pprof"
go func() {
	log.Println(http.ListenAndServe("localhost:6060", nil))
}()
*/

/*
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
*/
