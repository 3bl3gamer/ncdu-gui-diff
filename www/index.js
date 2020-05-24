/** @typedef {{name:string, asize:number, dsize?:number, ino:number}} ReportRawNode */
/** @typedef {{fpath:string, root:ReportNode, nodeById:Map<number,ReportNode>}} Report */
/** @typedef {{roots:DiffNode[], nodeById:Map<string,DiffNode>, report0:Report, report1:Report}} Diff */

const $ = document.querySelector.bind(document)
const reportFpaths = /** @type {string[]} */ (JSON.parse($('#dataBlock').textContent).reportFpaths)

/**
 * @class
 * @param {number} id
 * @param {string} name
 * @param {'file'|'dir'} type
 * @param {number} level
 * @param {ReportNode[]} children
 */
function ReportNode(id, name, type, level, children) {
	this.id = id
	this.name = name
	this.type = type
	this.level = level
	this.children = children
}

/**
 * @class
 * @param {ReportNode?} node0
 * @param {ReportNode?} node1
 * @param {DiffNode[]} children
 */
function DiffNode(node0, node1, children) {
	this.id = (node0 ? node0.id : '-') + '|' + (node1 ? node1.id : '-')
	this.name = /** @type {ReportNode} */ (node0 || node1).name
	this.type = /** @type {ReportNode} */ (node0 || node1).type
	this.level = /** @type {ReportNode} */ (node0 || node1).level
	this.node0 = node0
	this.node1 = node1
	this.children = children
}
DiffNode.prototype.wasCreated = function () {
	return this.node0 === null
}
DiffNode.prototype.wasRemoved = function () {
	return this.node1 === null
}

/**
 * @param {ReportRawNode|ReportRawNode[]} data
 * @param {number} level
 * @param {{lastId:number}} state
 * @returns {ReportNode}
 */
function convertNode(data, level, state) {
	const nodeData = Array.isArray(data) ? data[0] : data
	const childrenData = Array.isArray(data) ? data.slice(1) : []
	return new ReportNode(
		++state.lastId,
		nodeData.name,
		Array.isArray(data) ? 'dir' : 'file',
		level,
		childrenData.map(x => convertNode(x, level + 1, state)),
	)
}
/**
 * @param {string} fpath
 * @param {string} dataStr
 * @returns {Report}
 */
function convertReport(fpath, dataStr) {
	const data = JSON.parse(dataStr)
	const ncduInfo = data[2]
	if (!('progver' in ncduInfo))
		console.warn(`strange report ${fpath}: expected 3rd element to be object with 'progver' property`)
	if (ncduInfo.progver !== '1.14.2') console.warn(`expected ncdu v1.14.2, got v${ncduInfo.progver}`)
	const root = convertNode(data[3], 0, { lastId: 0 })
	const nodeById = /** @type {Map<number,ReportNode>} */ (new Map())
	;(function iter(/** @type {ReportNode} */ node) {
		if (nodeById.has(node.id)) throw new Error(`id ${node.id} already exists`)
		nodeById.set(node.id, node)
		node.children.forEach(iter)
	})(root)
	return { fpath, root, nodeById }
}

const reportsMap = /** @type {Object<string,{data:Report?, promise:Promise<{}>}>} */ ({})
function loadReportData(fpath) {
	let report = reportsMap[fpath]
	if (!report) {
		const promise = window.internal_loadReportData(fpath).then(data => {
			report.data = convertReport(fpath, data)
			return report.data
		})
		report = reportsMap[fpath] = { data: null, promise }
	}
	return report.promise
}
/** @param {string} reportFpath */
function getReportDataIfAny(reportFpath) {
	const report = reportsMap[reportFpath]
	return report ? report.data : null
}

/**
 * @param {ReportNode[]} nodes
 * @returns {Map<string,ReportNode>}
 */
function makeNodeByNameMap(nodes) {
	const map = new Map()
	for (let i = 0; i < nodes.length; i++) map.set(nodes[i].name, nodes[i])
	return map
}
/**
 * @param {ReportNode[]} nodes0
 * @param {ReportNode[]} nodes1
 * @returns {DiffNode[]}
 */
function diffChildren(nodes0, nodes1) {
	const res = /** @type {DiffNode[]} */ ([])
	const node0ByName = makeNodeByNameMap(nodes0)
	const node1ByName = makeNodeByNameMap(nodes1)
	for (let i = 0; i < nodes0.length; i++) {
		const node0 = nodes0[i]
		const node1 = node1ByName.get(node0.name) || null
		if (node1) node1ByName.delete(node0.name)
		const children = diffChildren(node0.children, node1 ? node1.children : [])
		res.push(new DiffNode(node0, node1, children))
	}
	for (const node1 of node1ByName.values()) {
		res.push(new DiffNode(null, node1, diffChildren([], node1.children)))
	}
	return res
}
/**
 * @param {Report} report0
 * @param {Report} report1
 * @returns {Diff}
 */
function calcDiff(report0, report1) {
	const roots = diffChildren([report0.root], [report1.root])
	const nodeById = /** @type {Map<string,DiffNode>} */ (new Map())
	function iter(/** @type {DiffNode} */ node) {
		if (nodeById.has(node.id)) throw new Error(`id ${node.id} already exists`)
		nodeById.set(node.id, node)
		node.children.forEach(iter)
	}
	roots.forEach(iter)
	return { roots, nodeById, report0, report1 }
}

// ===

function fillReportsTable() {
	const table = /** @type {HTMLTableElement} */ ($('#reportsTable'))
	for (const rep of reportFpaths) {
		const row = table.tBodies[0].insertRow()
		row.insertCell().textContent = rep
		row.insertCell().textContent = '-'
	}
}

/**
 * @param {HTMLTableRowElement} row
 * @param {DiffNode} node
 */
function fillNodeRow(row, node) {
	row.dataset.id = '' + node.id
	row.className = 'node'
	if (node.type === 'dir') row.classList.add('collapsable', 'collapsed')
	if (node.wasCreated()) row.classList.add('created')
	if (node.wasRemoved()) row.classList.add('removed')

	const nameCell = row.insertCell()
	nameCell.textContent = node.name
	nameCell.className = 'name'
	nameCell.style.paddingLeft = node.level * 16 + 'px'
	row.insertCell().textContent = '' + node.children.length
}
/**
 * @param {HTMLTableRowElement} row
 * @param {DiffNode} node
 */
function toggleRowCollapse(row, node) {
	const tbody = /** @type {HTMLTableSectionElement} */ (row.parentElement)
	let rowIndex = 0
	for (; rowIndex < tbody.rows.length; rowIndex++) if (tbody.rows[rowIndex] === row) break

	if (row.classList.contains('collapsed')) {
		for (let i = 0; i < node.children.length; i++) {
			fillNodeRow(tbody.insertRow(rowIndex + i + 1), node.children[i])
		}
	} else {
		for (let i = 0; i < node.children.length; i++) {
			const r = tbody.rows[rowIndex + 1]
			if (r.classList.contains('collapsable') && !r.classList.contains('collapsed'))
				toggleRowCollapse(r, node.children[i])
			tbody.deleteRow(rowIndex + 1)
		}
	}
	row.classList.toggle('collapsed')
}
function refillDiffTable() {
	const table = /** @type {HTMLTableElement} */ ($('#diffTable'))
	table.tBodies[0].innerHTML = ''

	const report0 = getReportDataIfAny(reportFpaths[0])
	const report1 = getReportDataIfAny(reportFpaths[reportFpaths.length - 1])
	if (report0 === null || report1 === null) return

	const diff = calcDiff(report0, report1)

	for (const root of diff.roots) fillNodeRow(table.tBodies[0].insertRow(), root)
	// toggleRowCollapse(table.tBodies[0].rows[0], diff.roots)

	table.onclick = e => {
		// console.log(e && e.target && e.target instanceof HTMLElement)
		if (e && e.target && e.target instanceof HTMLElement) {
			const row = /** @type {HTMLTableRowElement} */ (e.target.closest('tr'))
			const node = diff.nodeById.get(row.dataset.id || '')
			// console.log(node, node && node.type, e.target.classList.contains('name'))
			if (node && node.type === 'dir' && e.target.classList.contains('name')) {
				toggleRowCollapse(row, node)
			}
		}
	}
}

fillReportsTable()
refillDiffTable()

loadReportData(reportFpaths[0]).then(refillDiffTable)
loadReportData(reportFpaths[reportFpaths.length - 1]).then(refillDiffTable)
