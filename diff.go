package main

type DiffNodeCore struct {
	Entry0 *NcduFileEntry `json:"entry0"`
	Entry1 *NcduFileEntry `json:"entry1"`
	Level  int32          `json:"level"`
	Aggr0  *Aggregation   `json:"aggr0"`
	Aggr1  *Aggregation   `json:"aggr1"`
}

type DiffNode struct {
	DiffNodeCore
	Children []*DiffNode `json:"children"`
}

func (n DiffNode) Name() string {
	if n.Entry0 != nil {
		return n.Entry0.Name
	} else {
		return n.Entry1.Name
	}
}

type DiffReport struct {
	Roots            []*DiffNode
	Report0, Report1 *Report
}

func makeNodeByNameMap(nodes []*ReportNode) map[string]*ReportNode {
	res := make(map[string]*ReportNode, len(nodes))
	for _, node := range nodes {
		res[node.Entry.File().Name] = node
	}
	return res
}

func makeDiffNode(node0, node1 *ReportNode) *DiffNode {
	var level int32
	var entry0, entry1 *NcduFileEntry
	var aggr0, aggr1 *Aggregation
	var children0, children1 []*ReportNode
	if node0 != nil {
		level = node0.Level
		entry0 = node0.Entry.File()
		aggr0 = node0.Aggr
		children0 = node0.Children
	}
	if node1 != nil {
		level = node1.Level
		entry1 = node1.Entry.File()
		aggr1 = node1.Aggr
		children1 = node1.Children
	}
	return &DiffNode{
		DiffNodeCore{Entry0: entry0, Entry1: entry1, Aggr0: aggr0, Aggr1: aggr1, Level: level},
		diffChildren(children0, children1),
	}
}

func diffChildren(nodes0, nodes1 []*ReportNode) []*DiffNode {
	res := make([]*DiffNode, 0, max(len(nodes0), len(nodes1)))
	node1ByName := makeNodeByNameMap(nodes1)
	for _, node0 := range nodes0 {
		node1 := node1ByName[node0.Entry.File().Name]
		if node1 != nil {
			delete(node1ByName, node0.Entry.File().Name)
		}
		res = append(res, makeDiffNode(node0, node1))
		// res = append(res, &DiffNode{Entry0: node0.Entry.File(), Entry1: entry1, Level: node0.Level, Children: children})
	}
	for _, node1 := range node1ByName {
		res = append(res, makeDiffNode(nil, node1))
		// res = append(res, &DiffNode{Entry0: nil, Entry1: node1.Entry.File(), Level: node1.Level, Children: diffChildren(nil, node1.Children)})
	}
	return res
}

func CalcDiff(report0, report1 *Report) *DiffReport {
	roots := diffChildren(report0.Roots, report1.Roots)
	return &DiffReport{Report0: nil, Report1: nil, Roots: roots}
}
