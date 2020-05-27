/** @typedef {{name:string}} NcduEntry */
/** @typedef {{children:number}} Aggregation */

/**
 * @param {number|null|undefined} a
 * @param {number|null|undefined} b
 */
function numDiff(a, b) {
	if (a === null || a === undefined) return '' + b
	if (b === null || b === undefined) return '' + a
	if (a === b) return '' + a
	return `${b} (<span class="${b > a ? 'inc' : 'dec'}">${b - a}</span>)`
}

/**
 * @template T
 * @param {T|null} val
 * @returns {T}
 */
function mustBeNotNull(val) {
	if (val === null) throw new Error('value is null, this should not happen')
	return val
}

/**
 * @class
 * @param {DiffNode?} parent
 * @param {{entry0:NcduEntry?, entry1:NcduEntry?, aggr0:Aggregation?, aggr1:Aggregation?, level:number}} data
 */
function DiffNode(parent, { entry0, entry1, aggr0, aggr1, level }) {
	this.parent = parent
	this.entry0 = entry0
	this.entry1 = entry1
	this.aggr0 = aggr0
	this.aggr1 = aggr1
	this.level = level
	this.children = /** @type {DiffNode[]?} */ (null)
}
DiffNode.prototype.name = function () {
	return /** @type {NcduEntry} */ (this.entry0 || this.entry1).name
}
DiffNode.prototype.isExpandable = function () {
	return (this.aggr0 && this.aggr0.children > 0) || (this.aggr1 && this.aggr1.children > 0)
}
DiffNode.prototype.wasCreated = function () {
	return this.entry0 === null
}
DiffNode.prototype.wasRemoved = function () {
	return this.entry1 === null
}
DiffNode.prototype.path = function () {
	const res = /** @type {string[]} */ (Array(this.level + 1))
	let node = /** @type {DiffNode?} */ (this)
	while (node !== null) {
		res[node.level] = node.name()
		node = node.parent
	}
	return res
}
DiffNode.prototype.pathStr = function () {
	return JSON.stringify(this.path())
}
DiffNode.prototype.loadChildren = function () {
	if (this.children !== null) return Promise.resolve(this.children)
	return loadChildren(this, this.path()).then(children => {
		this.children = children
		return children
	})
}

const roots = /** @type {DiffNode[]} */ ([])
/** @param {string|string[]} pathOrStr */
function getNodeByPath(pathOrStr) {
	const path = typeof pathOrStr === 'string' ? /** @type {string[]} */ (JSON.parse(pathOrStr)) : pathOrStr
	let node = /** @type {DiffNode?} */ (null)
	let children = /** @type {DiffNode[]?} */ (roots)
	for (const part of path) {
		let found = false
		for (const child of mustBeNotNull(children)) {
			if (child.name() === part) {
				node = child
				children = node.children
				found = true
				break
			}
		}
		if (!found) throw new Error(`part '${part}' not found`)
	}
	return mustBeNotNull(node)
}

/**
 * @param {HTMLTableRowElement} row
 * @param {DiffNode} node
 */
function fillNodeRow(row, node) {
	row.dataset.path = node.pathStr()
	row.className = 'node'
	if (node.isExpandable()) row.classList.add('collapsable', 'collapsed')
	if (node.wasCreated()) row.classList.add('created')
	if (node.wasRemoved()) row.classList.add('removed')

	const nameCell = row.insertCell()
	nameCell.textContent = node.name()
	nameCell.className = 'name'
	nameCell.style.paddingLeft = node.level * 16 + 'px'
	row.insertCell().innerHTML = numDiff(node.aggr0?.children, node.aggr1?.children)
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
		node.loadChildren().then(children => {
			for (let i = 0; i < children.length; i++) {
				fillNodeRow(tbody.insertRow(rowIndex + i + 1), children[i])
			}
		})
	} else {
		const children = mustBeNotNull(node.children)
		for (let i = 0; i < children.length; i++) {
			const r = tbody.rows[rowIndex + 1]
			if (r.classList.contains('collapsable') && !r.classList.contains('collapsed'))
				toggleRowCollapse(r, children[i])
			tbody.deleteRow(rowIndex + 1)
		}
	}
	row.classList.toggle('collapsed')
}

function refillDiffTable() {
	const table = /** @type {HTMLTableElement} */ ($('#diffTable'))
	table.tBodies[0].innerHTML = ''

	for (const root of roots) fillNodeRow(table.tBodies[0].insertRow(), root)

	table.onclick = e => {
		// console.log(e && e.target && e.target instanceof HTMLElement)
		if (e && e.target && e.target instanceof HTMLElement) {
			const row = /** @type {HTMLTableRowElement} */ (e.target.closest('tr'))
			const node = getNodeByPath(row.dataset.path || '')
			// console.log(node, node && node.type, e.target.classList.contains('name'))
			if (node && node.isExpandable() && e.target.classList.contains('name')) {
				toggleRowCollapse(row, node)
			}
		}
	}
}

// fillReportsTable()
// refillDiffTable()

// loadReportData(reportFpaths[0]).then(refillDiffTable)
// loadReportData(reportFpaths[reportFpaths.length - 1]).then(refillDiffTable)

const $ = document.querySelector.bind(document)
// const reportFpaths = /** @type {string[]} */ (JSON.parse($('#dataBlock').textContent).reportFpaths)
// console.log(reportFpaths)

/**
 * @param {DiffNode?} parentNode
 * @param {string[]} path
 */
function loadChildren(parentNode, path) {
	return window.internal_getChildren(path).then(children => {
		return children.map(x => new DiffNode(parentNode, x))
	})
}

loadChildren(null, []).then(children => {
	roots.length = 0
	roots.push(...children)
	refillDiffTable()
})
