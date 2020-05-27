package main

import "github.com/ansel1/merry"

func max(a, b int) int {
	if a > b {
		return a
	} else {
		return b
	}
}

type JsonRawSliceMessage []byte

// UnmarshalJSON sets *m to a slice (not copy!) of original data.
func (m *JsonRawSliceMessage) UnmarshalJSON(data []byte) error {
	if m == nil {
		return merry.New("JsonRawSliceMessage: UnmarshalJSON on nil pointer")
	}
	*m = data
	return nil
}
