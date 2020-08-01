/** @typedef {{name:string}} NcduEntry */
/** @typedef {{children:number, files:number, disr:number, asize:number, dsize:number}} Aggregation */

function toString(a) {
	return '' + a
}

/** @param {number} n */
function sign(n) {
	return n > 0 ? '+' : n < 0 ? '-' : ''
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
 * @param {number|null|undefined} a
 * @param {number|null|undefined} b
 * @param {((val:number, delta?:number) => [string, string])|undefined} [formatFunc]
 */
function numDiff(a, b, formatFunc) {
	formatFunc = formatFunc || formatSimple
	if (a === null || a === undefined) return formatFunc(/** @type {number} */ (b))
	if (b === null || b === undefined) return formatFunc(a)
	if (a === b) return formatFunc(a)
	return formatFunc(b, b - a)
}

/**
 * @param {{}?} a
 * @param {{}?} b
 * @param {string} attr
 * @param {((val:number, delta?:number) => [string, string])|undefined} [formatFunc]
 */
function numDiffAttr(a, b, attr, formatFunc) {
	return numDiff(a && a[attr], b && b[attr], formatFunc)
}

/**
 * @param {number} val
 * @param {number|undefined} [delta]
 * @returns {[string, string]}
 */
function formatSimple(val, delta) {
	const valStr = prettifyNumber(val, 0)
	const deltaStr = delta === undefined ? '' : prettifyNumber(Math.abs(delta), 0)
	return [
		delta === undefined
			? ''
			: `<span class="${delta > 0 ? 'inc' : 'dec'}">${sign(delta)}${deltaStr}</span>`,
		`${valStr}`,
	]
}

/**
 * @param {number} val
 * @param {number|undefined} [delta]
 * @returns {[string, string]}
 */
function formatSize(val, delta) {
	const valStr = prettifyNumber(val / 1024 / 1024, 1)
	const deltaStr = delta === undefined ? '' : prettifyNumber(Math.abs(delta / 1024 / 1024), 1)
	return [
		delta === undefined
			? ''
			: `<span class="${delta > 0 ? 'inc' : 'dec'}">${sign(delta)}${deltaStr}</span> `,
		valStr,
	]
}

/**
 * @param {number} value
 * @param {number} fractionDigits
 */
function prettifyNumber(value, fractionDigits) {
	const fractLen = fractionDigits === 0 ? 0 : fractionDigits + 1 //+ dot
	let valStr = value.toFixed(fractionDigits)
	for (let i = valStr.length - fractLen - 3; i > 0; i -= 3)
		valStr = valStr.substr(0, i) + '&thinsp;' + valStr.substr(i)
	return fractLen > 0 ? valStr.slice(0, -2) + `<span class="dim">${valStr.slice(-2)}</span>` : valStr
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
 * @param {string} className
 */
function insertCell(row, className) {
	const cell = row.insertCell()
	cell.className = className
	return cell
}
/**
 * @param {string} tagName
 * @param {string} className
 * @param {HTMLElement} parent
 */
function appendElement(tagName, className, parent) {
	const elem = document.createElement(tagName)
	elem.className = className
	parent.appendChild(elem)
	return elem
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

	const c = className => insertCell(row, className)
	const e = appendElement
	const [aggr0, aggr1] = [node.aggr0, node.aggr1]

	const nameCell = c('name')
	const nameInner = e('span', 'inner', nameCell)
	nameInner.textContent = node.name()
	nameInner.style.marginLeft = node.level * 12 + 'px'
	;[c('dsize diff').innerHTML, c('dsize val').innerHTML] = numDiffAttr(aggr0, aggr1, 'dsize', formatSize)
	;[c('asize diff').innerHTML, c('asize val').innerHTML] = numDiffAttr(aggr0, aggr1, 'asize', formatSize)
	;[c('files diff').innerHTML, c('files val').innerHTML] = numDiffAttr(aggr0, aggr1, 'files')
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
			if (node && node.isExpandable() && e.target.closest('.name')) {
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
 * @param {DiffNode} a
 * @param {DiffNode} b
 */
function sortByDSizeDelta(a, b) {
	const aSize0 = a.aggr0 ? a.aggr0.dsize : 0
	const aSize1 = a.aggr1 ? a.aggr1.dsize : 0
	const aDelta = aSize1 - aSize0
	const bSize0 = b.aggr0 ? b.aggr0.dsize : 0
	const bSize1 = b.aggr1 ? b.aggr1.dsize : 0
	const bDelta = bSize1 - bSize0
	if (aDelta === 0 && bDelta === 0) return a.name().localeCompare(b.name())
	if (aDelta === 0) return 1
	if (bDelta === 0) return -1
	return bDelta - aDelta
}

/**
 * @param {DiffNode?} parentNode
 * @param {string[]} path
 */
function loadChildren(parentNode, path) {
	return window.internal_getChildren(path).then(children => {
		return children.map(x => new DiffNode(parentNode, x)).sort(sortByDSizeDelta)
	})
}

loadChildren(null, []).then(children => {
	roots.length = 0
	roots.push(...children)
	refillDiffTable()
	toggleRowCollapse($('#diffTable').tBodies[0].rows[0], roots[0])
})
