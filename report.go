package main

type Aggregation struct {
	Children int64 `json:"children"`
	Files    int64 `json:"files"`
	Dirs     int64 `json:"dirs"`
	Asize    int64 `json:"asize"`
	Dsize    int64 `json:"dsize"`
}

type ReportNode struct {
	Entry    NcduEntry
	Level    int32
	Aggr     *Aggregation
	Children []*ReportNode
}

type Report struct {
	FPath string
	Roots []*ReportNode
}

func ReportNodeFromNcdu(entry NcduEntry, level int32) *ReportNode {
	aggr := &Aggregation{}
	var children []*ReportNode
	if dir, ok := entry.(*NcduDirEntry); ok {
		children = make([]*ReportNode, len(dir.Children()))
		aggr.Children = int64(len(children))
		for i, ncduChild := range dir.Children() {
			child := ReportNodeFromNcdu(ncduChild, level+1)
			children[i] = child
			aggr.Files += child.Aggr.Files + 1
			if _, ok := ncduChild.(*NcduDirEntry); ok {
				aggr.Dirs += 1
			}
			aggr.Dirs += child.Aggr.Dirs
			aggr.Asize += child.Aggr.Asize
			aggr.Dsize += child.Aggr.Dsize
		}
	}
	aggr.Asize += entry.File().Asize
	aggr.Dsize += entry.File().Dsize
	return &ReportNode{Entry: entry, Level: level, Aggr: aggr, Children: children}
}

func ReportFromNcdu(fpath string, ncdu *NcduReport) *Report {
	root := ReportNodeFromNcdu(ncdu.Root, 0)
	return &Report{FPath: fpath, Roots: []*ReportNode{root}}
}
