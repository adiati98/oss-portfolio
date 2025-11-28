/**
 * Main class to handle table interactions (Sort, Search, Reset)
 */

// --- Constants for Status Sorting ---
// Custom Priority 1: Open -> Merged -> Closed (Higher score is better/more actionable)
const STATUS_PRIORITY_P1 = {
  OPEN: 3,
  MERGED: 2,
  CLOSED: 1,
  'N/A': 0,
};

// Custom Priority 2: Merged -> Closed -> Open (Second cycle, prioritizing Merged/Closed over Open)
const STATUS_PRIORITY_P2 = {
  OPEN: 1,
  MERGED: 3,
  CLOSED: 2,
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

    // Store original order for reset/unsort
    this.rows.forEach((row, index) => row.setAttribute('data-original-index', index));

    // Updated state to track custom cycles (e.g., 'custom1', 'custom2' for status)
    this.currentSort = { column: null, direction: 'default' };

    this.init();
  }

  init() {
    // Attach Sort Listeners
    this.headers.forEach((th, index) => {
      // Only attach listener if 'data-type' is present (to make 'No.' column static)
      if (th.hasAttribute('data-type')) {
        th.addEventListener('click', () => this.handleSort(th, index));
        th.style.cursor = 'pointer';
        th.title = 'Click to sort';
      }
    });

    // Attach Search Listener
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
    }

    // Attach Reset Listener
    if (this.resetBtn) {
      this.resetBtn.addEventListener('click', () => this.resetAll());
    }
  }

  /**
   * Determine next sort direction based on current state and column type.
   */
  getNextDirection(columnIndex, type) {
    const { column, direction } = this.currentSort;

    if (column !== columnIndex) {
      // New column clicked: Set initial direction
      if (type === 'date') return 'desc'; // Dates start newest first (Desc)
      if (type === 'number') return 'asc'; // Numbers/Periods start smallest first (Asc)
      if (type === 'status') return 'custom1'; // Status starts with Custom 1
      return 'asc'; // Strings start A->Z (Asc)
    }

    // Same column clicked again: Cycle logic
    if (type === 'status') {
      if (direction === 'custom1') return 'custom2';
      if (direction === 'custom2') return 'default';
      return 'custom1';
    } else if (type === 'date') {
      if (direction === 'desc') return 'asc';
      if (direction === 'asc') return 'default';
      return 'desc';
    } else if (type === 'number' || type === 'string') {
      if (direction === 'asc') return 'desc';
      if (direction === 'desc') return 'default';
      return 'asc';
    } else {
      return 'default';
    }
  }

  /**
   * Utility to get a comparable value for 'number' columns, handling N/A states.
   * This is critical for differentiating N/A strings from the number 0.
   */
  getNumberComparableValue(val, direction) {
    const numericVal = parseFloat(val);
    // Check if the value is a valid, finite number (not NaN, not Infinity)
    const isNumeric = !isNaN(numericVal) && isFinite(numericVal);

    if (isNumeric) {
      return numericVal;
    } else {
      // String/N/A encountered (representing 'Open')
      if (direction === 'asc') {
        // ASC: N/A must come BEFORE 0. Use negative infinity.
        return Number.NEGATIVE_INFINITY;
      } else {
        // direction === 'desc'
        // DESC: N/A must come AFTER the longest period (N -> 0). Use positive infinity.
        return Number.POSITIVE_INFINITY;
      }
    }
  }

  /**
   * Updates the content of the first <td> in every VISIBLE row to reflect its current index (1-based).
   * Ensures the 'No.' column is sequential after any reordering or filtering.
   */
  updateRowNumbers() {
    let visibleCounter = 1;
    this.rows.forEach((row) => {
      // Only update rows that are currently visible (not hidden by search filter)
      if (row.style.display !== 'none') {
        const firstCell = row.children[0];
        if (firstCell) {
          firstCell.textContent = `${visibleCounter}.`;
          visibleCounter++;
        }
      }
    });
  }

  /**
   * Sort Logic: Implements the requested multi-state cycles.
   */
  handleSort(th, columnIndex) {
    const type = th.getAttribute('data-type') || 'string';
    const nextDir = this.getNextDirection(columnIndex, type);

    // 1. Reset all header indicators
    this.headers.forEach((h) => {
      h.classList.remove('sort-asc', 'sort-desc', 'sort-custom1', 'sort-custom2');
      const icon = h.querySelector('.sort-icon');
      if (icon) icon.textContent = '↕';
    });

    this.currentSort = { column: columnIndex, direction: nextDir };

    // 2. Sorting implementation
    if (nextDir === 'default') {
      // Restore original order
      this.rows.sort((a, b) => {
        return (
          parseInt(a.getAttribute('data-original-index')) -
          parseInt(b.getAttribute('data-original-index'))
        );
      });
      th.classList.remove('sort-asc', 'sort-desc', 'sort-custom1', 'sort-custom2');
    } else {
      // Update UI icon
      const icon = th.querySelector('.sort-icon');
      if (icon) {
        // Use '▼' for Descending (largest first) or Custom sort
        if (nextDir === 'desc' || nextDir === 'custom1' || nextDir === 'custom2') {
          icon.textContent = '▼';
        } else {
          // asc (smallest first)
          icon.textContent = '▲';
        }
      }
      th.classList.add(`sort-${nextDir}`);

      this.rows.sort((rowA, rowB) => {
        const cellA = rowA.children[columnIndex];
        const cellB = rowB.children[columnIndex];

        let valA = cellA.getAttribute('data-value') || cellA.textContent.trim(); // Keep original casing for parsing
        let valB = cellB.getAttribute('data-value') || cellB.textContent.trim();

        let comparison = 0;

        // Custom logic for status
        if (type === 'status') {
          const priorityMap = nextDir === 'custom1' ? STATUS_PRIORITY_P1 : STATUS_PRIORITY_P2;
          const scoreA = priorityMap[valA.toUpperCase()] || 0;
          const scoreB = priorityMap[valB.toUpperCase()] || 0;
          comparison = scoreB - scoreA;
        }
        // Logic for Date/Number/String
        else {
          let compA, compB; // Declare scope outside of if blocks

          if (type === 'date') {
            compA = new Date(valA).getTime();
            compB = new Date(valB).getTime();
            if (isNaN(compA) || isNaN(compB)) {
              comparison = String(valA).toLowerCase().localeCompare(String(valB).toLowerCase());
            } else {
              comparison = compA - compB;
            }
          } else if (type === 'number') {
            // Get comparable value, where N/A is mapped to +/- Infinity based on direction
            compA = this.getNumberComparableValue(valA, nextDir);
            compB = this.getNumberComparableValue(valB, nextDir);

            // Standard comparison (A - B) at this stage.
            // This is correct for the ASC case, and correctly places N/A in the DESC case.
            comparison = compA - compB;

            if (nextDir === 'desc') {
              // Check if both values are finite (actual numbers, not Infinity/N/A)
              if (isFinite(compA) && isFinite(compB)) {
                // Standard numeric sort is A-B. For DESC, we need B-A, or -(A-B).
                comparison = comparison * -1;
              }
              // If one or both is Infinity (N/A), the standard A-B comparison works:
              // -Inf vs Number = -Inf is smaller (N/A is on top)
              // +Inf vs Number = +Inf is larger (N/A is on bottom)
            }
          } else {
            // string
            comparison = String(valA).toLowerCase().localeCompare(String(valB).toLowerCase());
          }
        }

        // Apply direction multiplier based on the requested nextDir
        if (type !== 'status') {
          if (type === 'number') {
            // The comparison for 'number' is fully handled within the block above (including the DESC reversal for finite numbers).
            return comparison;
          }
          if (nextDir === 'asc') {
            // Strings and Dates (Ascending)
            return comparison;
          }
          if (nextDir === 'desc') {
            // Strings and Dates (Descending)
            return comparison * -1;
          }
        }

        return comparison;
      });
    }

    // Re-append rows (this actually moves them in the DOM)
    this.rows.forEach((row) => this.tbody.appendChild(row));

    // Re-number the rows to maintain sequential order (1, 2, 3...)
    this.updateRowNumbers();
  }

  /**
   * Search Logic
   */
  handleSearch(query) {
    const lowerQuery = query.toLowerCase().trim();

    // Check for "status:" strict mode
    let statusSearch = null;
    let textSearch = lowerQuery;

    if (lowerQuery.startsWith('status:')) {
      statusSearch = lowerQuery.replace('status:', '').trim();
      textSearch = null; // Disable general text search
    }

    // Helper to find column index by type (added for robustness in status search)
    const getColumnIndexByType = (type) => {
      return Array.from(this.headers).findIndex((th) => th.getAttribute('data-type') === type);
    };

    this.rows.forEach((row) => {
      let shouldShow = false;

      // STRICT STATUS SEARCH
      if (statusSearch !== null) {
        const statusColIndex = getColumnIndexByType('status');

        if (statusColIndex !== -1) {
          // Access the cell using the column index
          const statusCell = row.children[statusColIndex];

          const statusValue = (
            statusCell.getAttribute('data-value') || statusCell.textContent
          ).toLowerCase();

          if (statusValue.includes(statusSearch)) shouldShow = true;
        }
      }
      // GENERAL SEARCH (Only simple text match remains)
      else if (textSearch) {
        // We search through the row's text content
        const rowText = row.textContent.toLowerCase();

        // Check simple text match
        if (rowText.includes(textSearch)) {
          shouldShow = true;
        }
      } else {
        // Empty query
        shouldShow = true;
      }

      row.style.display = shouldShow ? '' : 'none';
    });

    // Re-number the visible rows after filtering
    this.updateRowNumbers();
  }

  resetAll() {
    this.searchInput.value = '';
    // Restore sort
    this.currentSort = { column: null, direction: 'default' };
    this.headers.forEach((h) => {
      h.classList.remove('sort-asc', 'sort-desc', 'sort-custom1', 'sort-custom2');
      const icon = h.querySelector('.sort-icon');
      if (icon) icon.textContent = '↕';
    });

    // Restore Order
    this.rows.sort((a, b) => {
      return (
        parseInt(a.getAttribute('data-original-index')) -
        parseInt(b.getAttribute('data-original-index'))
      );
    });
    this.rows.forEach((row) => {
      this.tbody.appendChild(row);
      row.style.display = ''; // Show all
    });

    // Re-number the rows after resetting order
    this.updateRowNumbers();
  }
}

// Initialize on Load
document.addEventListener('DOMContentLoaded', () => {
  const detailsSections = document.querySelectorAll('details');
  detailsSections.forEach((details) => {
    // Ensure table exists before initializing
    if (details.querySelector('table')) {
      new ReportTableManager(details);
    }
  });
});
