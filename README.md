# ncdu-gui-diff
Shows diffs between NCDU reports (exported via `ncdu -o report.json /path`).

![Example](https://user-images.githubusercontent.com/1857617/83322656-36511680-a262-11ea-84a4-8976c98751b1.png)

## Building

```
go build
```

## Usage

```
$ ./ncdu_gui_diff --help
Usage: ./ncdu_gui_diff [OPTIONS] fileA fileB
  -ignore value
    	File/dir path to ignore (can be specified several times)
```

For example

`./ncdu_gui_diff report_old.json report_new.json`

or

`./ncdu_gui_diff --ignore /some/dir --ignore /boring/file.txt report_old.json report_new.json`
