/**
 * Main class to handle table interactions (Sort, Search, Reset)
 */

// --- Constants for Status Sorting ---
// Custom Priority 1: Open -> Merged -> Closed (Focus on progress)
const STATUS_PRIORITY_P1 = {
  OPEN: 3,
  MERGED: 2,
  CLOSED: 1,
  'N/A': 0,
};

// Custom Priority 2: Closed -> Merged -> Open (Historical view)
const STATUS_PRIORITY_P2 = {
  CLOSED: 3,
  MERGED: 2,
  OPEN: 1,
  'N/A': 0,
};

class ReportTableManager {
  constructor(detailsElement) {
    this.detailsElement = detailsElement;
    this.table = detailsElement.querySelector('table');
    this.tbody = this.table.querySelector('tbody');
    this.rows = Array.from(this.tbody.querySelectorAll('tr'));
    this.searchInput = detailsElement.querySelector('.search-input');
    this.resetBtn = detailsElement.querySelector('.reset-btn');
    this.headers = detailsElement.querySelectorAll('th');

    // Store original order for reset
    this.rows.forEach((row, index) => row.setAttribute('data-original-index', index));

    this.currentSort = { column: null, direction: 'default' };

    this.init();
  }

  init() {
    this.headers.forEach((th, index) => {
      if (th.hasAttribute('data-type')) {
        th.addEventListener('click', () => this.handleSort(th, index));
        th.style.cursor = 'pointer';
        th.title = 'Click to sort';
      }
    });

    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
    }

    if (this.resetBtn) {
      this.resetBtn.addEventListener('click', () => this.resetAll());
    }
  }

  getNextDirection(columnIndex, type) {
    const { column, direction } = this.currentSort;

    if (column !== columnIndex) {
      if (type === 'date') return 'desc';
      if (type === 'number') return 'asc';
      if (type === 'status') return 'custom1';
      return 'asc';
    }

    if (type === 'status') {
      if (direction === 'custom1') return 'custom2';
      if (direction === 'custom2') return 'default';
      return 'custom1';
    } else if (type === 'date') {
      if (direction === 'desc') return 'asc';
      if (direction === 'asc') return 'default';
      return 'desc';
    } else {
      if (direction === 'asc') return 'desc';
      if (direction === 'desc') return 'default';
      return 'asc';
    }
  }

  getNumberComparableValue(val, direction) {
    const numericVal = parseFloat(val);
    const isNumeric = !isNaN(numericVal) && isFinite(numericVal);
    if (isNumeric) return numericVal;
    return direction === 'asc' ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
  }

  updateRowNumbers() {
    let visibleCounter = 1;
    this.rows.forEach((row) => {
      if (row.style.display !== 'none') {
        const firstCell = row.children[0];
        if (firstCell) {
          firstCell.textContent = `${visibleCounter}.`;
          visibleCounter++;
        }
      }
    });
  }

  handleSort(th, columnIndex) {
    const type = th.getAttribute('data-type') || 'string';
    const nextDir = this.getNextDirection(columnIndex, type);

    this.headers.forEach((h) => {
      h.classList.remove('sort-asc', 'sort-desc', 'sort-custom1', 'sort-custom2');
      const icon = h.querySelector('.sort-icon');
      if (icon) icon.textContent = '↕';
    });

    this.currentSort = { column: columnIndex, direction: nextDir };

    if (nextDir === 'default') {
      this.rows.sort((a, b) => {
        return (
          parseInt(a.getAttribute('data-original-index')) -
          parseInt(b.getAttribute('data-original-index'))
        );
      });
    } else {
      const icon = th.querySelector('.sort-icon');
      if (icon) {
        icon.textContent = nextDir === 'desc' || nextDir === 'custom2' ? '▼' : '▲';
      }
      th.classList.add(`sort-${nextDir}`);

      // Find indices if they exist in this table for tie-breaking
      const headerArray = Array.from(this.headers);
      const dateIdx = headerArray.findIndex((h) => h.getAttribute('data-type') === 'date');

      this.rows.sort((rowA, rowB) => {
        const cellA = rowA.children[columnIndex];
        const cellB = rowB.children[columnIndex];

        let valA = (cellA.getAttribute('data-value') || cellA.textContent).trim();
        let valB = (cellB.getAttribute('data-value') || cellB.textContent).trim();

        // 1. Status Logic: Sort by Priority then Tie-break by Date
        if (type === 'status') {
          const priorityMap = nextDir === 'custom1' ? STATUS_PRIORITY_P1 : STATUS_PRIORITY_P2;
          const scoreA = priorityMap[valA.toUpperCase()] || 0;
          const scoreB = priorityMap[valB.toUpperCase()] || 0;

          if (scoreA !== scoreB) return scoreB - scoreA;

          // Tie-breaker: Find date within the status cell OR from a date column
          const dateMatchA = cellA.textContent.match(/\d{4}-\d{2}-\d{2}/);
          const dateMatchB = cellB.textContent.match(/\d{4}-\d{2}-\d{2}/);

          let dA, dB;
          if (dateMatchA && dateMatchB) {
            dA = new Date(dateMatchA[0]).getTime();
            dB = new Date(dateMatchB[0]).getTime();
          } else if (dateIdx !== -1) {
            dA = new Date(rowA.children[dateIdx].getAttribute('data-value')).getTime();
            dB = new Date(rowB.children[dateIdx].getAttribute('data-value')).getTime();
          }

          return nextDir === 'custom1' ? dB - dA : dA - dB;
        }

        // 2. Date Logic: Strict Chronology
        if (type === 'date') {
          const dA = new Date(valA).getTime();
          const dB = new Date(valB).getTime();
          let comp = isNaN(dA) || isNaN(dB) ? valA.localeCompare(valB) : dA - dB;
          return nextDir === 'desc' ? comp * -1 : comp;
        }

        // 3. Number Logic: Handles N/A and Infinity
        if (type === 'number') {
          let compA = this.getNumberComparableValue(valA, nextDir);
          let compB = this.getNumberComparableValue(valB, nextDir);
          let comp = compA - compB;
          if (nextDir === 'desc' && isFinite(compA) && isFinite(compB)) comp *= -1;
          return comp;
        }

        // 4. String Logic
        let res = valA.toLowerCase().localeCompare(valB.toLowerCase());
        return nextDir === 'desc' ? res * -1 : res;
      });
    }

    this.rows.forEach((row) => this.tbody.appendChild(row));
    this.updateRowNumbers();
  }

  handleSearch(query) {
    const lowerQuery = query.toLowerCase().trim();
    let statusSearch = null;
    let textSearch = lowerQuery;

    if (lowerQuery.startsWith('status:')) {
      statusSearch = lowerQuery.replace('status:', '').trim();
      textSearch = null;
    }

    const getColIdx = (t) =>
      Array.from(this.headers).findIndex((th) => th.getAttribute('data-type') === t);

    this.rows.forEach((row) => {
      let show = false;
      if (statusSearch !== null) {
        const idx = getColIdx('status');
        if (idx !== -1) {
          const val = (
            row.children[idx].getAttribute('data-value') || row.children[idx].textContent
          ).toLowerCase();
          if (val.includes(statusSearch)) show = true;
        }
      } else if (textSearch) {
        if (row.textContent.toLowerCase().includes(textSearch)) show = true;
      } else {
        show = true;
      }
      row.style.display = show ? '' : 'none';
    });
    this.updateRowNumbers();
  }

  resetAll() {
    this.searchInput.value = '';
    this.currentSort = { column: null, direction: 'default' };
    this.headers.forEach((h) => {
      h.classList.remove('sort-asc', 'sort-desc', 'sort-custom1', 'sort-custom2');
      const icon = h.querySelector('.sort-icon');
      if (icon) icon.textContent = '↕';
    });
    this.rows.sort(
      (a, b) =>
        parseInt(a.getAttribute('data-original-index')) -
        parseInt(b.getAttribute('data-original-index'))
    );
    this.rows.forEach((row) => {
      this.tbody.appendChild(row);
      row.style.display = '';
    });
    this.updateRowNumbers();
  }
}

// Global Initialization
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('details').forEach((details) => {
    if (details.querySelector('table')) {
      new ReportTableManager(details);
    }
  });
});
