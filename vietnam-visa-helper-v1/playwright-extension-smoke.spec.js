const fs = require('fs');
const { test, expect } = require('playwright/test');
const path = require('path');

test.setTimeout(180000);

function buildMockPopupHtml() {
  return fs
    .readFileSync(path.resolve(__dirname, 'popup.html'), 'utf8')
    .replace(/\s*<script src="popup\.js"><\/script>\s*/i, '\n');
}

function buildMockPageHtml() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Mock eVisa Form</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; line-height: 1.4; }
    .field { margin-bottom: 18px; max-width: 520px; }
    .field label { display: block; margin-bottom: 6px; font-weight: 600; }
    input[type="text"], input[type="email"] { width: 100%; padding: 8px; box-sizing: border-box; }
    .ant-picker { position: relative; width: 100%; }
    .ant-picker-input {
      display: flex;
      align-items: center;
      min-height: 38px;
      border: 1px solid #c9c9c9;
      border-radius: 6px;
      padding: 4px 8px;
      background: #fff;
    }
    .ant-picker-input input {
      width: 100%;
      border: none;
      outline: none;
      background: transparent;
      padding: 0;
    }
    .ant-picker-dropdown {
      position: absolute;
      z-index: 9999;
      width: 100%;
      margin-top: 4px;
      background: white;
      border: 1px solid #c9c9c9;
      border-radius: 6px;
      box-shadow: 0 8px 18px rgba(0,0,0,0.12);
      padding: 10px;
      box-sizing: border-box;
    }
    .ant-picker-ok {
      margin-top: 8px;
      padding: 6px 10px;
      border: 1px solid #1f6feb;
      border-radius: 6px;
      background: #1f6feb;
      color: #fff;
      cursor: pointer;
    }
    .ant-select { position: relative; width: 100%; }
    .ant-select-selector {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 38px;
      border: 1px solid #c9c9c9;
      border-radius: 6px;
      padding: 4px 8px;
      background: #fff;
    }
    .ant-select-selection-item { flex: 1; min-height: 20px; }
    .ant-select-selection-search-input {
      width: 120px;
      border: none;
      outline: none;
      background: transparent;
    }
    .ant-select-dropdown {
      position: absolute;
      z-index: 9999;
      width: 100%;
      margin-top: 4px;
      background: white;
      border: 1px solid #c9c9c9;
      border-radius: 6px;
      box-shadow: 0 8px 18px rgba(0,0,0,0.12);
      max-height: 180px;
      overflow: auto;
    }
    .ant-select-dropdown-hidden { display: none; }
    .ant-select-item-option {
      padding: 8px 10px;
      cursor: pointer;
    }
    .ant-select-item-option:hover {
      background: #f0f7ff;
    }
  </style>
</head>
<body>
  <h1>Vietnam eVisa Mock Form</h1>

  <div class="field">
    <label for="surname">Surname</label>
    <input id="surname" type="text" placeholder="Surname" />
  </div>
  <div class="field">
    <label for="given_name">Given name</label>
    <input id="given_name" type="text" placeholder="Given name" />
  </div>
  <div class="field">
    <label for="email">Email</label>
    <input id="email" type="email" placeholder="Email address" />
  </div>
  <div class="field">
    <label for="passport_number">Passport number</label>
    <input id="passport_number" type="text" placeholder="Passport number" />
  </div>

  <div class="field">
    <label>Gender</label>
    <div class="ant-select" id="mock-gender" data-select-via-enter="true">
      <div class="ant-select-selector">
        <span class="ant-select-selection-item"></span>
        <input
          class="ant-select-selection-search-input"
          role="combobox"
          aria-expanded="false"
          aria-controls="mock-gender-list"
          id="basic_gender"
          autocomplete="off"
        />
      </div>
      <div class="ant-select-dropdown ant-select-dropdown-hidden">
        <div role="listbox" id="mock-gender-list">
          <div class="ant-select-item-option" role="option">Female</div>
          <div class="ant-select-item-option" role="option">Male</div>
          <div class="ant-select-item-option" role="option">Other</div>
        </div>
      </div>
    </div>
  </div>

  <div class="field">
    <label>Nationality</label>
    <div class="ant-select" id="mock-nationality" data-requires-search="true" data-confirm-delay="220">
      <div class="ant-select-selector">
        <span class="ant-select-selection-item"></span>
        <input
          class="ant-select-selection-search-input"
          role="combobox"
          aria-expanded="false"
          aria-controls="mock-nationality-list"
          id="basic_nationality"
          autocomplete="off"
        />
      </div>
      <div class="ant-select-dropdown ant-select-dropdown-hidden">
        <div role="listbox" id="mock-nationality-list">
          <div class="ant-select-item-option" role="option">American</div>
          <div class="ant-select-item-option" role="option">Chinese</div>
          <div class="ant-select-item-option" role="option">Singaporean</div>
        </div>
      </div>
    </div>
  </div>

  <div class="field">
    <label>Visa type</label>
    <div class="ant-select" id="mock-visa-type" data-requires-search="true">
      <div class="ant-select-selector">
        <span class="ant-select-selection-item"></span>
        <input
          class="ant-select-selection-search-input"
          role="combobox"
          aria-expanded="false"
          aria-controls="mock-visa-type-list"
          id="basic_visa_type"
          autocomplete="off"
        />
      </div>
      <div class="ant-select-dropdown ant-select-dropdown-hidden">
        <div role="listbox" id="mock-visa-type-list">
          <div class="ant-select-item-option" role="option">Multiple-entry</div>
          <div class="ant-select-item-option" role="option">Single-entry</div>
        </div>
      </div>
    </div>
  </div>

  <div class="field">
    <label>Passport type</label>
    <div class="ant-select" id="mock-passport-type">
      <div class="ant-select-selector">
        <span class="ant-select-selection-item"></span>
        <input
          class="ant-select-selection-search-input"
          role="combobox"
          aria-expanded="false"
          aria-controls="mock-passport-type-list"
          id="basic_hcLoai"
          autocomplete="off"
        />
      </div>
      <div class="ant-select-dropdown ant-select-dropdown-hidden">
        <div role="listbox" id="mock-passport-type-list">
          <div class="ant-select-item-option" role="option">Diplomatic Passport</div>
          <div class="ant-select-item-option" role="option">Official Passport</div>
          <div class="ant-select-item-option" role="option">Ordinary Passport</div>
        </div>
      </div>
    </div>
  </div>

  <div class="field">
    <label>Purpose of entry</label>
    <div class="ant-select" id="mock-purpose" data-requires-search="true">
      <div class="ant-select-selector">
        <span class="ant-select-selection-item"></span>
        <input
          class="ant-select-selection-search-input"
          role="combobox"
          aria-expanded="false"
          aria-controls="mock-purpose-list"
          id="basic_maMd"
          autocomplete="off"
        />
      </div>
      <div class="ant-select-dropdown ant-select-dropdown-hidden">
        <div role="listbox" id="mock-purpose-list">
          <div class="ant-select-item-option" role="option">Tourist</div>
          <div class="ant-select-item-option" role="option">Business</div>
          <div class="ant-select-item-option" role="option">Working</div>
          <div class="ant-select-item-option" role="option">Other</div>
        </div>
      </div>
    </div>
  </div>

  <div class="field">
    <label>Occupation</label>
    <div class="ant-select" id="mock-occupation" data-requires-search="true" data-search-delay="800">
      <div class="ant-select-selector">
        <span class="ant-select-selection-item"></span>
        <input
          class="ant-select-selection-search-input"
          role="combobox"
          aria-expanded="false"
          aria-controls="mock-occupation-list"
          id="basic_occupation"
          autocomplete="off"
        />
      </div>
      <div class="ant-select-dropdown ant-select-dropdown-hidden">
        <div role="listbox" id="mock-occupation-list">
          <div class="ant-select-item-option" role="option">Businessman</div>
          <div class="ant-select-item-option" role="option">Employee</div>
          <div class="ant-select-item-option" role="option">Student</div>
          <div class="ant-select-item-option" role="option">Retired</div>
        </div>
      </div>
    </div>
  </div>

  <div class="field">
    <label>Border gate of entry</label>
    <div class="ant-select" id="mock-border-gate">
      <div class="ant-select-selector">
        <span class="ant-select-selection-item"></span>
        <input
          class="ant-select-selection-search-input"
          role="combobox"
          aria-expanded="false"
          aria-controls="mock-border-gate-list"
          id="basic_ttcdNcCuaKhau"
          autocomplete="off"
        />
      </div>
      <div class="ant-select-dropdown ant-select-dropdown-hidden">
        <div role="listbox" id="mock-border-gate-list">
          <div class="ant-select-item-option" role="option">Can Tho International Airport</div>
          <div class="ant-select-item-option" role="option">Tan Son Nhat International Airport</div>
          <div class="ant-select-item-option" role="option">Noi Bai International Airport</div>
        </div>
      </div>
    </div>
  </div>

  <div class="field">
    <label>Province or city</label>
    <div class="ant-select" id="mock-province-city" data-requires-search="true">
      <div class="ant-select-selector">
        <span class="ant-select-selection-item"></span>
        <input
          class="ant-select-selection-search-input"
          role="combobox"
          aria-expanded="false"
          aria-controls="mock-province-city-list"
          id="basic_province_city"
          autocomplete="off"
        />
      </div>
      <div class="ant-select-dropdown ant-select-dropdown-hidden">
        <div role="listbox" id="mock-province-city-list">
          <div class="ant-select-item-option" role="option">Ha Noi</div>
          <div class="ant-select-item-option" role="option">Ho Chi Minh City</div>
          <div class="ant-select-item-option" role="option">Da Nang</div>
        </div>
      </div>
    </div>
  </div>

  <div class="field">
    <label>Expense coverage</label>
    <div class="ant-select" id="mock-expense-coverage" data-requires-search="true">
      <div class="ant-select-selector">
        <span class="ant-select-selection-item"></span>
        <input
          class="ant-select-selection-search-input"
          role="combobox"
          aria-expanded="false"
          aria-controls="mock-expense-coverage-list"
          id="basic_expense_coverage"
          autocomplete="off"
        />
      </div>
      <div class="ant-select-dropdown ant-select-dropdown-hidden">
        <div role="listbox" id="mock-expense-coverage-list">
          <div class="ant-select-item-option" role="option">Personal</div>
          <div class="ant-select-item-option" role="option">Company</div>
        </div>
      </div>
    </div>
  </div>

  <div class="field">
    <label>Payment method</label>
    <div class="ant-select" id="mock-payment-method" data-requires-search="true">
      <div class="ant-select-selector">
        <span class="ant-select-selection-item"></span>
        <input
          class="ant-select-selection-search-input"
          role="combobox"
          aria-expanded="false"
          aria-controls="mock-payment-method-list"
          id="basic_kpbhHinhThuc"
          autocomplete="off"
        />
      </div>
      <div class="ant-select-dropdown ant-select-dropdown-hidden">
        <div role="listbox" id="mock-payment-method-list">
          <div class="ant-select-item-option" role="option">Cash</div>
          <div class="ant-select-item-option" role="option">Credit card</div>
          <div class="ant-select-item-option" role="option">Traveller cheques</div>
        </div>
      </div>
    </div>
  </div>

  <div class="field">
    <label>Temporary residential address</label>
    <div class="ant-select" id="mock-destiny-address" data-accept-custom="true" data-open-disabled="true">
      <div class="ant-select-selector">
        <span class="ant-select-selection-item"></span>
        <input
          class="ant-select-selection-search-input"
          role="combobox"
          aria-expanded="false"
          aria-controls="mock-destiny-address-list"
          id="basic_ttcddcTamTru"
          autocomplete="off"
        />
      </div>
      <div class="ant-select-dropdown ant-select-dropdown-hidden">
        <div role="listbox" id="mock-destiny-address-list"></div>
      </div>
    </div>
  </div>

  <script>
    (() => {
      const setupSelect = (root) => {
        const selector = root.querySelector('.ant-select-selector');
        const input = root.querySelector('.ant-select-selection-search-input');
        const dropdown = root.querySelector('.ant-select-dropdown');
        const listbox = root.querySelector('[role="listbox"]');
        const selectionItem = root.querySelector('.ant-select-selection-item');
        const allOptions = Array.from(listbox.querySelectorAll('[role="option"]'));
        const requiresSearch = root.dataset.requiresSearch === 'true';
        const confirmDelay = Number(root.dataset.confirmDelay || '0');
        const selectViaEnter = root.dataset.selectViaEnter === 'true';
        const searchDelay = Number(root.dataset.searchDelay || '0');
        const acceptCustom = root.dataset.acceptCustom === 'true';
        const openDisabled = root.dataset.openDisabled === 'true';
        let pendingOption = null;
        let renderTimer = null;

        const commitSelection = (opt) => {
          selectionItem.textContent = opt.textContent.trim();
          selectionItem.setAttribute('title', opt.textContent.trim());
          root.dataset.value = opt.textContent.trim();
          input.value = '';
          pendingOption = null;
          input.dispatchEvent(new Event('change', { bubbles: true }));
          close();
        };

        const open = () => {
          if (openDisabled) return;
          dropdown.classList.remove('ant-select-dropdown-hidden');
          input.setAttribute('aria-expanded', 'true');
        };

        const close = () => {
          dropdown.classList.add('ant-select-dropdown-hidden');
          input.setAttribute('aria-expanded', 'false');
        };

        const render = (query = '') => {
          const normalized = query.toLowerCase().trim();
          const applyRender = () => {
            allOptions.forEach(opt => {
              const matched = requiresSearch
                ? normalized && opt.textContent.toLowerCase().includes(normalized)
                : !normalized || opt.textContent.toLowerCase().includes(normalized);
              opt.style.display = matched ? 'block' : 'none';
            });
          };

          clearTimeout(renderTimer);
          if (searchDelay > 0 && normalized) {
            allOptions.forEach(opt => { opt.style.display = 'none'; });
            renderTimer = setTimeout(applyRender, searchDelay);
          } else {
            applyRender();
          }
        };

        selector.addEventListener('click', () => {
          open();
          render(input.value);
          input.focus();
        });

        input.addEventListener('focus', () => {
          open();
          render(input.value);
        });

        input.addEventListener('keydown', (event) => {
          if (event.key === 'ArrowDown') {
            open();
            render(input.value);
          }
          if (event.key === 'Enter') {
            const firstVisible = pendingOption || allOptions.find(opt => opt.style.display !== 'none');
            if (firstVisible) {
              if (selectViaEnter) {
                commitSelection(firstVisible);
              } else {
                firstVisible.click();
              }
            } else if (acceptCustom && input.value.trim()) {
              const customText = input.value.trim();
              selectionItem.textContent = customText;
              selectionItem.setAttribute('title', customText);
              root.dataset.value = customText;
              close();
            }
          }
        });

        input.addEventListener('input', () => {
          open();
          render(input.value);
        });

        allOptions.forEach(opt => {
          opt.addEventListener('click', () => {
            if (selectViaEnter) {
              pendingOption = opt;
              return;
            }

            if (confirmDelay > 0) {
              setTimeout(() => commitSelection(opt), confirmDelay);
            } else {
              commitSelection(opt);
            }
          });
        });

        document.addEventListener('click', (event) => {
          if (!root.contains(event.target)) close();
        });
      };
      document.querySelectorAll('.ant-select').forEach(setupSelect);
    })();
  </script>
</body>
</html>`;
}

function buildControlledStandardInputsHtml() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Controlled Standard Inputs</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; line-height: 1.4; }
    .field { margin-bottom: 18px; max-width: 520px; }
    .field label { display: block; margin-bottom: 6px; font-weight: 600; }
    input[type="text"], input[type="email"] { width: 100%; padding: 8px; box-sizing: border-box; }
  </style>
</head>
<body>
  <h1>Controlled Standard Fields</h1>

  <div class="field">
    <label for="surname">Surname</label>
    <input id="surname" type="text" placeholder="Surname" data-controlled="true" />
  </div>
  <div class="field">
    <label for="given_name">Given name</label>
    <input id="given_name" type="text" placeholder="Given name" data-controlled="true" />
  </div>
  <div class="field">
    <label for="passport_number">Passport number</label>
    <input id="passport_number" type="text" placeholder="Passport number" data-controlled="true" />
  </div>
  <div class="field">
    <label for="email">Email</label>
    <input id="email" type="email" placeholder="Email address" data-controlled="true" />
  </div>

  <script>
    (() => {
      const state = {
        surname: '',
        given_name: '',
        passport_number: '',
        email: ''
      };

      const controlledInputs = Array.from(document.querySelectorAll('[data-controlled="true"]'));

      const render = () => {
        controlledInputs.forEach(input => {
          input.value = state[input.id] || '';
        });
      };

      controlledInputs.forEach(input => {
        input.addEventListener('input', event => {
          const isRealInputEvent =
            typeof InputEvent !== 'undefined' &&
            event instanceof InputEvent &&
            typeof event.inputType === 'string';

          if (!isRealInputEvent) return;
          state[input.id] = input.value;
        });

        input.addEventListener('blur', () => {
          input.value = state[input.id] || '';
        });
      });

      setTimeout(render, 350);
      setTimeout(render, 900);
      setTimeout(render, 1600);
    })();
  </script>
</body>
</html>`;
}

function buildMockDatePickerHtml() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Mock eVisa Date Form</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; line-height: 1.4; }
    .field { margin-bottom: 18px; max-width: 520px; }
    .field label { display: block; margin-bottom: 6px; font-weight: 600; }
    .ant-picker { position: relative; width: 100%; }
    .ant-picker-input {
      display: flex;
      align-items: center;
      min-height: 38px;
      border: 1px solid #c9c9c9;
      border-radius: 6px;
      padding: 4px 8px;
      background: #fff;
    }
    .ant-picker-input input {
      width: 100%;
      border: none;
      outline: none;
      background: transparent;
      padding: 0;
    }
    .ant-picker-dropdown {
      position: absolute;
      z-index: 9999;
      width: 100%;
      margin-top: 4px;
      background: white;
      border: 1px solid #c9c9c9;
      border-radius: 6px;
      box-shadow: 0 8px 18px rgba(0,0,0,0.12);
      padding: 10px;
      box-sizing: border-box;
    }
    .ant-picker-dropdown-hidden { display: none; }
    .ant-picker-ok {
      margin-top: 8px;
      padding: 6px 10px;
      border: 1px solid #1f6feb;
      border-radius: 6px;
      background: #1f6feb;
      color: #fff;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <h1>Vietnam eVisa Mock Date Form</h1>

  <div class="field">
    <label>Date of birth</label>
    <div class="ant-picker" id="mock-date-of-birth" data-commit-mode="blur">
      <div class="ant-picker-input">
        <input type="text" id="basic_date_of_birth" readonly autocomplete="off" />
      </div>
      <input type="hidden" class="mock-committed-date" />
      <div class="ant-picker-dropdown ant-picker-dropdown-hidden">
        <div class="ant-picker-panel">Type a date and blur to commit</div>
        <button type="button" class="ant-picker-ok">OK</button>
      </div>
    </div>
  </div>

  <div class="field">
    <label>Intended date of entry</label>
    <div class="ant-picker" id="mock-intended-entry-date" data-commit-mode="ok">
      <div class="ant-picker-input">
        <input type="text" id="basic_intended_date_of_entry" readonly autocomplete="off" />
      </div>
      <input type="hidden" class="mock-committed-date" />
      <div class="ant-picker-dropdown ant-picker-dropdown-hidden">
        <div class="ant-picker-panel">Type a date and click OK to commit</div>
        <button type="button" class="ant-picker-ok">OK</button>
      </div>
    </div>
  </div>

  <script>
    (() => {
      const setupDatePicker = (root) => {
        const input = root.querySelector('.ant-picker-input input');
        const dropdown = root.querySelector('.ant-picker-dropdown');
        const okButton = root.querySelector('.ant-picker-ok');
        const committedInput = root.querySelector('.mock-committed-date');
        const commitMode = root.dataset.commitMode || 'blur';

        const open = () => {
          dropdown.classList.remove('ant-picker-dropdown-hidden');
        };

        const close = () => {
          dropdown.classList.add('ant-picker-dropdown-hidden');
        };

        const isValidDate = (value) => /^\\d{2}\\/\\d{2}\\/\\d{4}$/.test((value || '').trim());

        const commit = () => {
          const value = (input.value || '').trim();
          if (!isValidDate(value)) return false;
          committedInput.value = value;
          root.dataset.value = value;
          input.value = value;
          input.setAttribute('value', value);
          input.dispatchEvent(new Event('change', { bubbles: true }));
          close();
          return true;
        };

        root.addEventListener('click', (event) => {
          if (event.target.closest('.ant-picker-ok')) return;
          open();
          input.focus();
        });

        input.addEventListener('focus', open);
        input.addEventListener('input', open);
        input.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter') return;
          if (commitMode !== 'ok') {
            commit();
          }
        });
        input.addEventListener('blur', () => {
          if (commitMode === 'blur') {
            commit();
          } else {
            close();
          }
        });

        okButton?.addEventListener('click', () => {
          commit();
          input.blur();
        });
      };

      document.querySelectorAll('.ant-picker').forEach(setupDatePicker);
    })();
  </script>
</body>
</html>`;
}

function buildMockUploadHtml() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Mock eVisa Upload Form</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; line-height: 1.4; }
    .field { margin-bottom: 18px; max-width: 520px; }
    .field label { display: block; margin-bottom: 6px; font-weight: 600; }
    .upload-status { font-size: 12px; color: #1f6feb; margin-top: 6px; }
  </style>
</head>
<body>
  <h1>Vietnam eVisa Mock Upload Form</h1>

  <div class="field">
    <label for="basic_anhMat">Portrait photo</label>
    <input id="basic_anhMat" type="file" accept="image/*" />
    <div class="upload-status" id="portrait-status">No file selected</div>
  </div>

  <div class="field">
    <label for="basic_anhHoChieu">Passport copy</label>
    <input id="basic_anhHoChieu" type="file" accept="image/*" />
    <div class="upload-status" id="passport-status">No file selected</div>
  </div>

  <script>
    (() => {
      const bindStatus = (inputId, statusId) => {
        const input = document.getElementById(inputId);
        const status = document.getElementById(statusId);
        input.addEventListener('change', () => {
          const file = input.files && input.files[0];
          status.textContent = file ? file.name : 'No file selected';
        });
      };

      bindStatus('basic_anhMat', 'portrait-status');
      bindStatus('basic_anhHoChieu', 'passport-status');
    })();
  </script>
</body>
</html>`;
}

function buildMockDynamicPaymentHtml() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Mock Dynamic Payment Form</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; line-height: 1.4; }
    .field { margin-bottom: 18px; max-width: 520px; }
    .field label { display: block; margin-bottom: 6px; font-weight: 600; }
    .hidden { display: none; }
    .ant-select { position: relative; width: 100%; }
    .ant-select-selector {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 38px;
      border: 1px solid #c9c9c9;
      border-radius: 6px;
      padding: 4px 8px;
      background: #fff;
    }
    .ant-select-selection-item { flex: 1; min-height: 20px; }
    .ant-select-selection-search-input {
      width: 120px;
      border: none;
      outline: none;
      background: transparent;
    }
    .ant-select-dropdown {
      position: absolute;
      z-index: 9999;
      width: 100%;
      margin-top: 4px;
      background: white;
      border: 1px solid #c9c9c9;
      border-radius: 6px;
      box-shadow: 0 8px 18px rgba(0,0,0,0.12);
      max-height: 180px;
      overflow: auto;
    }
    .ant-select-dropdown-hidden { display: none; }
    .ant-select-item-option { padding: 8px 10px; cursor: pointer; }
    .ant-select-item-option:hover { background: #f0f7ff; }
  </style>
</head>
<body>
  <h1>Vietnam eVisa Dynamic Payment Form</h1>

  <div class="field">
    <label>Bought insurance</label>
    <div class="ant-select" id="mock-bought-insurance">
      <div class="ant-select-selector">
        <span class="ant-select-selection-item"></span>
        <input
          class="ant-select-selection-search-input"
          role="combobox"
          aria-expanded="false"
          aria-controls="mock-bought-insurance-list"
          id="basic_kpbhMuaBaoHiem"
          autocomplete="off"
        />
      </div>
      <div class="ant-select-dropdown ant-select-dropdown-hidden">
        <div role="listbox" id="mock-bought-insurance-list">
          <div class="ant-select-item-option" role="option">Yes</div>
          <div class="ant-select-item-option" role="option">No</div>
        </div>
      </div>
    </div>
  </div>

  <div class="field hidden" id="dynamic-payment-wrapper">
    <label>Payment method</label>
    <div class="ant-select" id="mock-dynamic-payment-method" data-requires-search="true">
      <div class="ant-select-selector">
        <span class="ant-select-selection-item"></span>
        <input
          class="ant-select-selection-search-input"
          role="combobox"
          aria-expanded="false"
          aria-controls="mock-dynamic-payment-method-list"
          id="basic_kpbhHinhThuc"
          autocomplete="off"
        />
      </div>
      <div class="ant-select-dropdown ant-select-dropdown-hidden">
        <div role="listbox" id="mock-dynamic-payment-method-list">
          <div class="ant-select-item-option" role="option">Cash</div>
          <div class="ant-select-item-option" role="option">Credit card</div>
          <div class="ant-select-item-option" role="option">Traveller cheques</div>
        </div>
      </div>
    </div>
  </div>

  <script>
    (() => {
      const setupSelect = (root, onCommit) => {
        const selector = root.querySelector('.ant-select-selector');
        const input = root.querySelector('.ant-select-selection-search-input');
        const dropdown = root.querySelector('.ant-select-dropdown');
        const listbox = root.querySelector('[role="listbox"]');
        const selectionItem = root.querySelector('.ant-select-selection-item');
        const allOptions = Array.from(listbox.querySelectorAll('[role="option"]'));
        const requiresSearch = root.dataset.requiresSearch === 'true';

        const commitSelection = (opt) => {
          const text = opt.textContent.trim();
          selectionItem.textContent = text;
          selectionItem.setAttribute('title', text);
          root.dataset.value = text;
          input.value = '';
          input.dispatchEvent(new Event('change', { bubbles: true }));
          dropdown.classList.add('ant-select-dropdown-hidden');
          input.setAttribute('aria-expanded', 'false');
          onCommit && onCommit(text);
        };

        const open = () => {
          dropdown.classList.remove('ant-select-dropdown-hidden');
          input.setAttribute('aria-expanded', 'true');
        };

        const render = (query = '') => {
          const normalized = query.toLowerCase().trim();
          allOptions.forEach(opt => {
            const matched = !requiresSearch || !normalized || opt.textContent.toLowerCase().includes(normalized);
            opt.style.display = matched ? 'block' : 'none';
          });
        };

        selector.addEventListener('click', () => {
          open();
          render(input.value);
          input.focus();
        });

        input.addEventListener('focus', () => {
          open();
          render(input.value);
        });

        input.addEventListener('input', () => {
          open();
          render(input.value);
        });

        input.addEventListener('keydown', (event) => {
          if (event.key === 'ArrowDown') {
            open();
            render(input.value);
          }
          if (event.key === 'Enter') {
            const firstVisible = allOptions.find(opt => opt.style.display !== 'none');
            if (firstVisible) {
              commitSelection(firstVisible);
            }
          }
        });

        allOptions.forEach(opt => {
          opt.addEventListener('click', () => commitSelection(opt));
        });
      };

      setupSelect(document.getElementById('mock-bought-insurance'), (text) => {
        if (text.toLowerCase() === 'no') {
          setTimeout(() => {
            document.getElementById('dynamic-payment-wrapper').classList.remove('hidden');
            setupSelect(document.getElementById('mock-dynamic-payment-method'));
          }, 250);
        }
      });
    })();
  </script>
</body>
</html>`;
}

function buildMockPostFillNextGuidanceHtml() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Mock Post Fill Next Guidance</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; line-height: 1.4; }
    .field { margin-bottom: 16px; max-width: 520px; }
    .field label { display: block; margin-bottom: 6px; font-weight: 600; }
    input[type="text"], input[type="email"] { width: 100%; padding: 8px; box-sizing: border-box; }
    #mock-next-button { margin-top: 16px; padding: 10px 16px; border: none; border-radius: 6px; background: #1f6feb; color: #fff; cursor: pointer; }
  </style>
</head>
<body>
  <h1>Mock eVisa Form - Next Step Guidance</h1>

  <div class="vh-disclaimer-guide" id="legacy-disclaimer-guide">legacy disclaimer prompt</div>

  <div class="field">
    <label for="surname">Surname</label>
    <input id="surname" type="text" placeholder="Surname" />
  </div>
  <div class="field">
    <label for="given_name">Given name</label>
    <input id="given_name" type="text" placeholder="Given name" />
  </div>
  <div class="field">
    <label for="email">Email</label>
    <input id="email" type="email" placeholder="Email address" />
  </div>
  <div class="field">
    <label for="passport_number">Passport number</label>
    <input id="passport_number" type="text" placeholder="Passport number" />
  </div>

  <button id="mock-next-button" type="button">Next</button>
</body>
</html>`;
}

function buildMockCaptchaStepHtml() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Mock Captcha Step</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; line-height: 1.5; }
    .card { max-width: 560px; border: 1px solid #d1d5db; border-radius: 8px; padding: 18px; }
    .captcha-row { display: flex; align-items: center; gap: 12px; margin: 14px 0; }
    .captcha-image {
      width: 140px;
      height: 48px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: repeating-linear-gradient(45deg, #f3f4f6, #f3f4f6 8px, #e5e7eb 8px, #e5e7eb 16px);
      border: 1px dashed #9ca3af;
      border-radius: 6px;
      font-weight: 700;
      letter-spacing: 2px;
    }
    #captchaInput { padding: 8px; width: 220px; }
    #captcha-next-btn { margin-top: 10px; padding: 10px 16px; border: none; border-radius: 6px; background: #1f6feb; color: #fff; cursor: pointer; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Verification Code</h1>
    <p>Please enter the captcha verification code before clicking Next.</p>
    <div class="captcha-row">
      <img
        id="captchaImage"
        class="captcha-image"
        src="https://www.evisa.gov.vn/mock-assets/captcha.png"
        alt="Captcha image"
      />
      <input id="captchaInput" type="text" name="captcha_code" placeholder="Enter captcha code" />
    </div>
    <button id="captcha-next-btn" type="button">Next</button>
  </div>
</body>
</html>`;
}

function buildMockPaymentReviewHtml() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Mock Payment Review Step</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; line-height: 1.5; }
    .card { max-width: 640px; border: 1px solid #d1d5db; border-radius: 10px; padding: 18px; }
    .row { display: flex; justify-content: space-between; margin: 8px 0; }
    .row span:first-child { color: #4b5563; }
    .total { margin-top: 14px; font-weight: 700; color: #111827; }
    #mock-pay-now {
      margin-top: 16px;
      padding: 10px 18px;
      border: none;
      border-radius: 6px;
      background: #0f766e;
      color: #fff;
      font-weight: 600;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Application Summary</h1>
    <p>Please review your application details and proceed to payment.</p>
    <div class="row"><span>Applicant</span><span>Zhang San</span></div>
    <div class="row"><span>Passport</span><span>E12345678</span></div>
    <div class="row"><span>Visa fee</span><span>USD 25</span></div>
    <div class="total">Total: USD 25</div>
    <button id="mock-pay-now" type="button">Pay now</button>
  </div>
</body>
</html>`;
}

test('content script autofill fills logged Ant Select problem cases', async ({ page }) => {
  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push(msg.text()));
  page.on('pageerror', error => consoleLogs.push(`PAGEERROR: ${error.message}`));

  await page.addInitScript(() => {
    const mockResponse = {
      userData: {
        personalInfo: {
          surname: 'Zhang',
          given_name: 'San',
          passport_number: 'E12345678',
          date_of_birth: '01/01/1990',
          gender: 'male',
          nationality: 'China',
          passport_type: 'ordinary'
        },
        contactInfo: {
          email: 'zhangsan@example.com'
        },
        visaInfo: {
          visa_type: 'single',
          intended_date_of_entry: '15/06/2026',
          intended_border_gate_of_entry: 'Noi Bai'
        },
        occupationInfo: {
          occupation: 'Engineer'
        },
        travelInfo: {
          purpose: 'Tourism',
          province_city: 'Hanoi',
          destination_address: '123 Tran Hung Dao Street, Hanoi, Vietnam'
        },
        tripExpenses: {
          expense_coverage: 'Myself',
          payment_method: 'credit_card'
        }
      },
      fieldMappings: {
        surname: { label_cn: '姓氏' },
        given_name: { label_cn: '名字' },
        email: { label_cn: '邮箱' },
        passport_number: { label_cn: '护照号' },
        date_of_birth: { label_cn: '出生日期' },
        gender: { label_cn: '性别' },
        nationality: { label_cn: '国籍' },
        visa_type: {
          label_cn: '签证类型',
          options: {
            single: '单次入境 (Single-entry)'
          }
        },
        purpose: {
          label_cn: '访问目的',
          options: {
            Tourist: '旅游 (Tourist)'
          }
        },
        intended_date_of_entry: { label_cn: '计划入境日期' },
        passport_type: {
          label_cn: '护照类型',
          options: {
            ordinary: '普通护照 (Ordinary Passport)'
          }
        },
        occupation: {
          label_cn: '职业',
          options: {
            Employee: '雇员 (Employee)'
          }
        },
        intended_border_gate_of_entry: {
          label_cn: '预计入境口岸',
          options: {
            'Noi Bai': '河内内排机场 (Noi Bai International Airport)'
          }
        },
        province_city: {
          label_cn: '省/市',
          options: {
            'Hanoi': '河内 (Hanoi)'
          }
        },
        expense_coverage: {
          label_cn: '谁将承担旅程的费用',
          options: {
            Personal: '个人承担 (Personal)'
          }
        },
        payment_method: {
          label_cn: '支付方式',
          options: {
            credit_card: '信用卡 (Credit card)'
          }
        },
        destiny_residential_address: {
          label_cn: '临时居住地址'
        }
      }
    };

    window.chrome = {
      runtime: {
        sendMessage(message, callback) {
          if (message && message.action === 'getUserData') {
            callback(mockResponse);
          } else if (callback) {
            callback({});
          }
        },
        openOptionsPage() {}
      }
    };
  });

  await page.route('https://www.evisa.gov.vn/mock-form', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: buildMockPageHtml()
    });
  });

  try {
    await page.goto('https://www.evisa.gov.vn/mock-form', { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ path: path.resolve(__dirname, 'content.js') });
    await page.waitForFunction(() => typeof window.fillAllFields === 'function', null, { timeout: 15000 });

    const fillResults = await page.evaluate(async () => {
      const genderResult = await window.fillAntSelectSmart(
        document.querySelector('#mock-gender'),
        'male',
        { key: 'gender', label_cn: '性别' }
      );
      const nationalityResult = await window.fillAntSelectSmart(
        document.querySelector('#mock-nationality'),
        'China',
        { key: 'nationality', label_cn: '国籍' }
      );
      const visaTypeResult = await window.fillAntSelectSmart(
        document.querySelector('#mock-visa-type'),
        'single',
        {
          key: 'visa_type',
          label_cn: '签证类型',
          options: { single: '单次入境 (Single-entry)' }
        }
      );
      const passportTypeResult = await window.fillAntSelectSmart(
        document.querySelector('#mock-passport-type'),
        'ordinary',
        {
          key: 'passport_type',
          label_cn: '护照类型',
          options: { ordinary: '普通护照 (Ordinary Passport)' }
        }
      );
      const purposeResult = await window.fillAntSelectSmart(
        document.querySelector('#mock-purpose'),
        'Tourism',
        {
          key: 'purpose',
          label_cn: '访问目的',
          options: { Tourist: '旅游 (Tourist)' }
        }
      );
      const occupationResult = await window.fillAntSelectSmart(
        document.querySelector('#mock-occupation'),
        'Engineer',
        {
          key: 'occupation',
          label_cn: '职业',
          options: { Employee: '雇员 (Employee)' }
        }
      );
      const borderGateResult = await window.fillAntSelectSmart(
        document.querySelector('#mock-border-gate'),
        'Noi Bai',
        {
          key: 'intended_border_gate_of_entry',
          label_cn: '预计入境口岸',
          options: { 'Noi Bai': '河内内排机场 (Noi Bai International Airport)' }
        }
      );
      const provinceCityResult = await window.fillAntSelectSmart(
        document.querySelector('#mock-province-city'),
        'Hanoi',
        {
          key: 'province_city',
          label_cn: '省/市',
          options: { 'Hanoi': '河内 (Hanoi)' }
        }
      );
      const expenseCoverageResult = await window.fillAntSelectSmart(
        document.querySelector('#mock-expense-coverage'),
        'Myself',
        {
          key: 'expense_coverage',
          label_cn: '谁将承担旅程的费用',
          options: { Personal: '个人承担 (Personal)' }
        }
      );
      const paymentMethodResult = await window.fillAntSelectSmart(
        document.querySelector('#mock-payment-method'),
        'credit_card',
        {
          key: 'payment_method',
          label_cn: '支付方式',
          options: { credit_card: '信用卡 (Credit card)' }
        }
      );
      const destinyAddressResult = await window.fillAntSelectSmart(
        document.querySelector('#mock-destiny-address'),
        '123 Tran Hung Dao Street, Hanoi, Vietnam',
        {
          key: 'destiny_residential_address',
          label_cn: '临时居住地址'
        }
      );

      return {
        genderResult,
        nationalityResult,
        visaTypeResult,
        passportTypeResult,
        purposeResult,
        occupationResult,
        borderGateResult,
        provinceCityResult,
        expenseCoverageResult,
        paymentMethodResult,
        destinyAddressResult
      };
    });
    expect(fillResults.genderResult).toBe(true);
    expect(fillResults.nationalityResult).toBe(true);
    expect(fillResults.visaTypeResult).toBe(true);
    expect(fillResults.passportTypeResult).toBe(true);
    expect(fillResults.purposeResult).toBe(true);
    expect(fillResults.occupationResult).toBe(true);
    expect(fillResults.borderGateResult).toBe(true);
    expect(fillResults.provinceCityResult).toBe(true);
    expect(fillResults.expenseCoverageResult).toBe(true);
    expect(fillResults.paymentMethodResult).toBe(true);
    expect(fillResults.destinyAddressResult).toBe(true);

    await expect(page.locator('#mock-gender .ant-select-selection-item')).toHaveText(/Male/i, { timeout: 10000 });
    await expect(page.locator('#mock-nationality .ant-select-selection-item')).toHaveText(/Chinese/i, { timeout: 10000 });
    await expect(page.locator('#mock-visa-type .ant-select-selection-item')).toHaveText(/Single-entry/i, { timeout: 10000 });
    await expect(page.locator('#mock-passport-type .ant-select-selection-item')).toHaveText(/Ordinary Passport/i, { timeout: 10000 });
    await expect(page.locator('#mock-purpose .ant-select-selection-item')).toHaveText(/Tourist/i, { timeout: 10000 });
    await expect(page.locator('#mock-occupation .ant-select-selection-item')).toHaveText(/Employee/i, { timeout: 10000 });
    await expect(page.locator('#mock-border-gate .ant-select-selection-item')).toHaveText(/Noi Bai International Airport/i, { timeout: 10000 });
    await expect(page.locator('#mock-province-city .ant-select-selection-item')).toHaveText(/Ha Noi/i, { timeout: 10000 });
    await expect(page.locator('#mock-expense-coverage .ant-select-selection-item')).toHaveText(/Personal/i, { timeout: 10000 });
    await expect(page.locator('#mock-payment-method .ant-select-selection-item')).toHaveText(/Credit card/i, { timeout: 10000 });
    await expect(page.locator('#mock-destiny-address .ant-select-selection-item')).toHaveText(/123 Tran Hung Dao Street/i, { timeout: 10000 });
  } catch (error) {
    const snippet = consoleLogs.slice(-80).join('\n');
    throw new Error(`${error.message}\n\nRecent console logs:\n${snippet}`);
  }
});

test('floating panel can be restored after minimizing', async ({ page }) => {
  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push(msg.text()));
  page.on('pageerror', error => consoleLogs.push(`PAGEERROR: ${error.message}`));

  await page.addInitScript(() => {
    const mockResponse = {
      userData: {
        personalInfo: {
          surname: 'Zhang'
        }
      },
      fieldMappings: {
        surname: { label_cn: '姓氏' }
      }
    };

    window.chrome = {
      runtime: {
        sendMessage(message, callback) {
          if (message && message.action === 'getUserData') {
            callback(mockResponse);
          } else if (callback) {
            callback({});
          }
        },
        openOptionsPage() {}
      }
    };
  });

  await page.route('https://www.evisa.gov.vn/mock-panel', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: buildMockPageHtml()
    });
  });

  try {
    await page.goto('https://www.evisa.gov.vn/mock-panel', { waitUntil: 'domcontentloaded' });
    await page.addStyleTag({ path: path.resolve(__dirname, 'styles.css') });
    await page.addScriptTag({ path: path.resolve(__dirname, 'content.js') });
    await page.waitForSelector('#visa-helper-panel', { timeout: 15000 });

    await expect(page.locator('#visa-helper-panel')).toHaveAttribute('aria-expanded', 'true');
    await page.locator('#vh-minimize').click();
    await expect(page.locator('#visa-helper-panel')).toHaveClass(/minimized/, { timeout: 10000 });
    await expect(page.locator('#visa-helper-panel')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#vh-panel-title')).toHaveText(/VN\s*V1/i, { timeout: 10000 });

    await page.locator('#visa-helper-panel').click();
    await expect(page.locator('#visa-helper-panel')).not.toHaveClass(/minimized/, { timeout: 10000 });
    await expect(page.locator('#visa-helper-panel')).toHaveAttribute('aria-expanded', 'true');
  } catch (error) {
    const snippet = consoleLogs.slice(-120).join('\n');
    throw new Error(`${error.message}\n\nRecent console logs:\n${snippet}`);
  }
});

test('content script fillAllFields populates standard inputs on the full mock form', async ({ page }) => {
  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push(msg.text()));
  page.on('pageerror', error => consoleLogs.push(`PAGEERROR: ${error.message}`));

  await page.addInitScript(() => {
    const mockResponse = {
      userData: {
        personalInfo: {
          surname: 'Zhang',
          given_name: 'San',
          gender: 'male',
          nationality: 'China',
          passport_number: 'E12345678',
          passport_type: 'ordinary'
        },
        contactInfo: {
          email: 'zhangsan@example.com'
        },
        occupationInfo: {
          occupation: 'Engineer'
        },
        travelInfo: {
          purpose: 'Tourism',
          destination_address: '123 Tran Hung Dao Street, Hanoi, Vietnam',
          province_city: 'Hanoi',
          ward_commune: 'Ba Dinh District, Hanoi'
        },
        visaInfo: {
          intended_border_gate_of_entry: 'Noi Bai',
          intended_border_gate_of_exit: 'Noi Bai'
        },
        tripExpenses: {
          bought_insurance: 'No',
          expense_coverage: 'Myself',
          payment_method: 'credit_card'
        },
        documents: {}
      },
      fieldMappings: {
        surname: { label_cn: '姓氏' },
        given_name: { label_cn: '名字' },
        email: { label_cn: '电子邮件地址' },
        passport_number: { label_cn: '护照号码' },
        gender: { label_cn: '性别', options: { male: '男 (Male)' } },
        nationality: { label_cn: '国籍', options: { China: '中国 (China)' } },
        passport_type: { label_cn: '护照类型', options: { ordinary: '普通护照 (Ordinary Passport)' } },
        occupation: { label_cn: '职业', options: { Employee: '雇员 (Employee)' } },
        purpose: { label_cn: '访问目的', options: { Tourist: '旅游 (Tourist)' } },
        province_city: { label_cn: '省/市', options: { Hanoi: '河内 (Hanoi)' } },
        ward_commune: { label_cn: '坊/社' },
        intended_border_gate_of_entry: { label_cn: '预计入境口岸' },
        intended_border_gate_of_exit: { label_cn: '预计出境口岸' },
        bought_insurance: { label_cn: '是否购买保险', options: { No: '否 (No)' } },
        expense_coverage: { label_cn: '谁将承担旅程的费用', options: { Personal: '个人承担 (Personal)' } },
        payment_method: { label_cn: '支付方式', options: { credit_card: '信用卡 (Credit card)' } }
      }
    };

    window.chrome = {
      runtime: {
        sendMessage(message, callback) {
          if (message && message.action === 'getUserData') {
            callback(mockResponse);
          } else if (message && message.action === 'getUploadDocuments') {
            callback({ documents: {} });
          } else if (callback) {
            callback({});
          }
        },
        getURL(relativePath) {
          return `chrome-extension://mock-extension-id/${relativePath}`;
        },
        openOptionsPage() {}
      },
      storage: {
        local: {
          get(_keys, callback) {
            callback({});
          }
        }
      }
    };
  });

  await page.route('https://www.evisa.gov.vn/mock-full-autofill', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: buildMockPageHtml()
    });
  });

  try {
    await page.goto('https://www.evisa.gov.vn/mock-full-autofill', { waitUntil: 'domcontentloaded' });
    await page.addStyleTag({ path: path.resolve(__dirname, 'styles.css') });
    await page.addScriptTag({ path: path.resolve(__dirname, 'content.js') });
    await page.waitForFunction(() => typeof window.fillAllFields === 'function', null, { timeout: 15000 });

    await page.evaluate(async () => {
      await window.fillAllFields();
    });

    await expect(page.locator('#surname')).toHaveValue('Zhang', { timeout: 10000 });
    await expect(page.locator('#given_name')).toHaveValue('San', { timeout: 10000 });
    await expect(page.locator('#email')).toHaveValue('zhangsan@example.com', { timeout: 10000 });
    await expect(page.locator('#passport_number')).toHaveValue('E12345678', { timeout: 10000 });
    await expect(page.locator('#mock-gender .ant-select-selection-item')).toHaveText(/Male/i, { timeout: 10000 });
    await expect(page.locator('#mock-nationality .ant-select-selection-item')).toHaveText(/Chinese/i, { timeout: 10000 });
    await expect(page.locator('#mock-passport-type .ant-select-selection-item')).toHaveText(/Ordinary Passport/i, { timeout: 10000 });
    await expect(page.locator('#mock-purpose .ant-select-selection-item')).toHaveText(/Tourist/i, { timeout: 10000 });
    await expect(page.locator('#mock-payment-method .ant-select-selection-item')).toHaveText(/Credit card/i, { timeout: 10000 });
  } catch (error) {
    const snippet = consoleLogs.slice(-160).join('\n');
    throw new Error(`${error.message}\n\nRecent console logs:\n${snippet}`);
  }
});

test('content script prompts manual Next guidance after autofill completes', async ({ page }) => {
  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push(msg.text()));
  page.on('pageerror', error => consoleLogs.push(`PAGEERROR: ${error.message}`));

  await page.addInitScript(() => {
    const mockResponse = {
      userData: {
        personalInfo: {
          surname: 'Zhang',
          given_name: 'San',
          passport_number: 'E12345678'
        },
        contactInfo: {
          email: 'zhangsan@example.com'
        }
      },
      fieldMappings: {
        surname: { label_cn: '姓氏' },
        given_name: { label_cn: '名字' },
        email: { label_cn: '电子邮件地址' },
        passport_number: { label_cn: '护照号码' }
      }
    };

    window.chrome = {
      runtime: {
        sendMessage(message, callback) {
          if (message && message.action === 'getUserData') {
            callback(mockResponse);
          } else if (message && message.action === 'getUploadDocuments') {
            callback({ documents: {} });
          } else if (callback) {
            callback({});
          }
        },
        openOptionsPage() {}
      }
    };
  });

  await page.route('https://www.evisa.gov.vn/mock-post-fill-guidance', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: buildMockPostFillNextGuidanceHtml()
    });
  });

  try {
    await page.goto('https://www.evisa.gov.vn/mock-post-fill-guidance', { waitUntil: 'domcontentloaded' });
    await page.addStyleTag({ path: path.resolve(__dirname, 'styles.css') });
    await page.addScriptTag({ path: path.resolve(__dirname, 'content.js') });
    await page.waitForFunction(() => typeof window.fillAllFields === 'function', null, { timeout: 15000 });

    await page.evaluate(async () => {
      await window.fillAllFields();
    });

    await expect(page.locator('#surname')).toHaveValue('Zhang', { timeout: 10000 });
    await expect(page.locator('#given_name')).toHaveValue('San', { timeout: 10000 });
    await expect(page.locator('#email')).toHaveValue('zhangsan@example.com', { timeout: 10000 });
    await expect(page.locator('#passport_number')).toHaveValue('E12345678', { timeout: 10000 });
    await expect(page.locator('#vh-stats small')).toContainText('填充完成，请手动点击 Next', { timeout: 10000 });
    await expect(page.locator('#mock-next-button')).toHaveClass(/vh-apply-highlight/, { timeout: 10000 });
    await expect(page.locator('.vh-top-banner')).toContainText('手动点击 Next', { timeout: 3000 });
    await expect(page.locator('#legacy-disclaimer-guide')).toHaveCount(0, { timeout: 10000 });
    await page.waitForTimeout(6200);
    await expect(page.locator('.vh-top-banner')).toContainText('手动点击 Next', { timeout: 3000 });
  } catch (error) {
    const snippet = consoleLogs.slice(-160).join('\n');
    throw new Error(`${error.message}\n\nRecent console logs:\n${snippet}`);
  }
});

test('content script guides users on captcha verification step', async ({ page }) => {
  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push(msg.text()));
  page.on('pageerror', error => consoleLogs.push(`PAGEERROR: ${error.message}`));

  await page.addInitScript(() => {
    window.chrome = {
      runtime: {
        sendMessage(message, callback) {
          if (message && message.action === 'getUserData') {
            callback({ userData: {}, fieldMappings: {} });
          } else if (callback) {
            callback({});
          }
        },
        openOptionsPage() {}
      }
    };
  });

  await page.route('https://www.evisa.gov.vn/mock-captcha-step', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: buildMockCaptchaStepHtml()
    });
  });

  try {
    await page.goto('https://www.evisa.gov.vn/mock-captcha-step', { waitUntil: 'domcontentloaded' });
    await page.addStyleTag({ path: path.resolve(__dirname, 'styles.css') });
    await page.addScriptTag({ path: path.resolve(__dirname, 'content.js') });

    await expect(page.locator('#vh-stats small')).toContainText('验证码步骤', { timeout: 10000 });
    await expect(page.locator('.vh-top-banner')).toContainText('验证码步骤', { timeout: 3000 });
    await page.waitForTimeout(6200);
    await expect(page.locator('.vh-top-banner')).toContainText('验证码步骤', { timeout: 3000 });

    const outline = await page.locator('#captchaInput').evaluate(el => el.style.outline || '');
    expect(outline).toContain('2px');
  } catch (error) {
    const snippet = consoleLogs.slice(-120).join('\n');
    throw new Error(`${error.message}\n\nRecent console logs:\n${snippet}`);
  }
});

test('content script provides persistent guidance on payment step', async ({ page }) => {
  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push(msg.text()));
  page.on('pageerror', error => consoleLogs.push(`PAGEERROR: ${error.message}`));

  await page.addInitScript(() => {
    window.chrome = {
      runtime: {
        sendMessage(message, callback) {
          if (message && message.action === 'getUserData') {
            callback({ userData: {}, fieldMappings: {} });
          } else if (callback) {
            callback({});
          }
        },
        openOptionsPage() {}
      }
    };
  });

  await page.route('https://www.evisa.gov.vn/mock-payment-review', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: buildMockPaymentReviewHtml()
    });
  });

  try {
    await page.goto('https://www.evisa.gov.vn/mock-payment-review', { waitUntil: 'domcontentloaded' });
    await page.addStyleTag({ path: path.resolve(__dirname, 'styles.css') });
    await page.addScriptTag({ path: path.resolve(__dirname, 'content.js') });

    await expect(page.locator('#vh-stats small')).toContainText('准备支付', { timeout: 10000 });
    await expect(page.locator('.vh-top-banner')).toContainText('准备支付', { timeout: 3000 });
    await expect(page.locator('#mock-pay-now')).toHaveClass(/vh-apply-highlight/, { timeout: 10000 });
    await page.waitForTimeout(6200);
    await expect(page.locator('.vh-top-banner')).toContainText('准备支付', { timeout: 3000 });
  } catch (error) {
    const snippet = consoleLogs.slice(-120).join('\n');
    throw new Error(`${error.message}\n\nRecent console logs:\n${snippet}`);
  }
});

test('content script smart standard input filler survives controlled rerenders', async ({ page }) => {
  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push(msg.text()));
  page.on('pageerror', error => consoleLogs.push(`PAGEERROR: ${error.message}`));

  await page.route('https://www.evisa.gov.vn/mock-controlled-standard-inputs', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: buildControlledStandardInputsHtml()
    });
  });

  try {
    await page.goto('https://www.evisa.gov.vn/mock-controlled-standard-inputs', { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ path: path.resolve(__dirname, 'content.js') });
    await page.waitForFunction(() => typeof window.fillStandardInputSmart === 'function', null, { timeout: 15000 });

    await page.evaluate(async () => {
      await window.fillStandardInputSmart(
        document.querySelector('#surname'),
        'Zhang',
        { key: 'surname', label_cn: '姓氏' }
      );
      await window.fillStandardInputSmart(
        document.querySelector('#given_name'),
        'San',
        { key: 'given_name', label_cn: '名字' }
      );
      await window.fillStandardInputSmart(
        document.querySelector('#passport_number'),
        'E12345678',
        { key: 'passport_number', label_cn: '护照号码' }
      );
      await window.fillStandardInputSmart(
        document.querySelector('#email'),
        'zhangsan@example.com',
        { key: 'email', label_cn: '电子邮件地址' }
      );
    });

    await page.waitForTimeout(2200);

    await expect(page.locator('#surname')).toHaveValue('Zhang', { timeout: 10000 });
    await expect(page.locator('#given_name')).toHaveValue('San', { timeout: 10000 });
    await expect(page.locator('#passport_number')).toHaveValue('E12345678', { timeout: 10000 });
    await expect(page.locator('#email')).toHaveValue('zhangsan@example.com', { timeout: 10000 });
  } catch (error) {
    const snippet = consoleLogs.slice(-120).join('\n');
    throw new Error(`${error.message}\n\nRecent console logs:\n${snippet}`);
  }
});

test('content script autofill commits Ant DatePicker values', async ({ page }) => {
  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push(msg.text()));
  page.on('pageerror', error => consoleLogs.push(`PAGEERROR: ${error.message}`));

  await page.addInitScript(() => {
    const mockResponse = {
      userData: {
        personalInfo: {
          date_of_birth: '01/01/1990'
        },
        visaInfo: {
          intended_date_of_entry: '15/06/2026'
        }
      },
      fieldMappings: {
        date_of_birth: { label_cn: '出生日期' },
        intended_date_of_entry: { label_cn: '计划入境日期' }
      }
    };

    window.chrome = {
      runtime: {
        sendMessage(message, callback) {
          if (message && message.action === 'getUserData') {
            callback(mockResponse);
          } else if (callback) {
            callback({});
          }
        },
        openOptionsPage() {}
      }
    };
  });

  await page.route('https://www.evisa.gov.vn/mock-date-form', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: buildMockDatePickerHtml()
    });
  });

  try {
    await page.goto('https://www.evisa.gov.vn/mock-date-form', { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ path: path.resolve(__dirname, 'content.js') });
    await page.waitForFunction(() => typeof window.fillAllFields === 'function', null, { timeout: 15000 });

    const fillResults = await page.evaluate(async () => {
      const dobResult = await window.fillAntPickerSmart(
        document.querySelector('#mock-date-of-birth'),
        '01/01/1990',
        { key: 'date_of_birth', label_cn: '出生日期' }
      );
      const entryResult = await window.fillAntPickerSmart(
        document.querySelector('#mock-intended-entry-date'),
        '15/06/2026',
        { key: 'intended_date_of_entry', label_cn: '计划入境日期' }
      );

      return { dobResult, entryResult };
    });

    expect(fillResults.dobResult).toBe(true);
    expect(fillResults.entryResult).toBe(true);
    await expect(page.locator('#mock-date-of-birth .mock-committed-date')).toHaveValue('01/01/1990', { timeout: 10000 });
    await expect(page.locator('#mock-intended-entry-date .mock-committed-date')).toHaveValue('15/06/2026', { timeout: 10000 });
    await expect(page.locator('#mock-date-of-birth .ant-picker-input input')).toHaveValue('01/01/1990', { timeout: 10000 });
    await expect(page.locator('#mock-intended-entry-date .ant-picker-input input')).toHaveValue('15/06/2026', { timeout: 10000 });
  } catch (error) {
    const snippet = consoleLogs.slice(-80).join('\n');
    throw new Error(`${error.message}\n\nRecent console logs:\n${snippet}`);
  }
});

test('content script autofill fills payment method when it appears late', async ({ page }) => {
  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push(msg.text()));
  page.on('pageerror', error => consoleLogs.push(`PAGEERROR: ${error.message}`));

  await page.addInitScript(() => {
    const mockResponse = {
      userData: {
        tripExpenses: {
          bought_insurance: 'No',
          payment_method: 'credit_card'
        }
      },
      fieldMappings: {
        bought_insurance: {
          label_cn: '是否购买保险',
          options: {
            No: '否 (No)'
          }
        },
        payment_method: {
          label_cn: '支付方式',
          options: {
            credit_card: '信用卡 (Credit card)'
          }
        }
      }
    };

    window.chrome = {
      runtime: {
        sendMessage(message, callback) {
          if (message && message.action === 'getUserData') {
            callback(mockResponse);
          } else if (message && message.action === 'getUploadDocuments') {
            callback({ documents: {} });
          } else if (callback) {
            callback({});
          }
        },
        openOptionsPage() {}
      }
    };
  });

  await page.route('https://www.evisa.gov.vn/mock-dynamic-payment-form', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: buildMockDynamicPaymentHtml()
    });
  });

  try {
    await page.goto('https://www.evisa.gov.vn/mock-dynamic-payment-form', { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ path: path.resolve(__dirname, 'content.js') });
    await page.waitForFunction(() => typeof window.fillAllFields === 'function', null, { timeout: 15000 });

    await page.evaluate(async () => {
      await window.fillAllFields();
    });

    await expect(page.locator('#mock-bought-insurance .ant-select-selection-item')).toHaveText(/No/i, { timeout: 10000 });
    await expect(page.locator('#mock-dynamic-payment-method .ant-select-selection-item')).toHaveText(/Credit card/i, { timeout: 10000 });
  } catch (error) {
    const snippet = consoleLogs.slice(-120).join('\n');
    throw new Error(`${error.message}\n\nRecent console logs:\n${snippet}`);
  }
});

test('content script autofill assigns stored upload files to file inputs', async ({ page }) => {
  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push(msg.text()));
  page.on('pageerror', error => consoleLogs.push(`PAGEERROR: ${error.message}`));

  await page.addInitScript(() => {
    const tinyPng =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2WZ6QAAAAASUVORK5CYII=';

    const mockResponse = {
      userData: {
        documents: {
          passport_photo: {
            file_name: 'portrait-photo.png',
            mime_type: 'image/png',
            size: 68,
            data_url: tinyPng
          },
          passport_copy: {
            file_name: 'passport-copy.png',
            mime_type: 'image/png',
            size: 68,
            data_url: tinyPng
          }
        }
      },
      fieldMappings: {
        passport_photo: { label_cn: '照片（正面）' },
        passport_copy: { label_cn: '护照复印件' }
      }
    };

    window.chrome = {
      runtime: {
        sendMessage(message, callback) {
          if (message && message.action === 'getUserData') {
            callback(mockResponse);
          } else if (callback) {
            callback({});
          }
        },
        openOptionsPage() {}
      }
    };
  });

  await page.route('https://www.evisa.gov.vn/mock-upload-form', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: buildMockUploadHtml()
    });
  });

  try {
    await page.goto('https://www.evisa.gov.vn/mock-upload-form', { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ path: path.resolve(__dirname, 'content.js') });
    await page.waitForFunction(() => typeof window.fillAllFields === 'function', null, { timeout: 15000 });

    await page.evaluate(async () => {
      await window.fillAllFields();
    });

    await page.waitForFunction(() => {
      const portrait = document.querySelector('#basic_anhMat');
      const passport = document.querySelector('#basic_anhHoChieu');
      return portrait?.files?.length === 1 && passport?.files?.length === 1;
    }, null, { timeout: 10000 });

    const uploadState = await page.evaluate(() => {
      const portrait = document.querySelector('#basic_anhMat');
      const passport = document.querySelector('#basic_anhHoChieu');
      return {
        portraitName: portrait.files[0].name,
        portraitType: portrait.files[0].type,
        portraitSize: portrait.files[0].size,
        passportName: passport.files[0].name,
        passportType: passport.files[0].type,
        passportSize: passport.files[0].size
      };
    });

    expect(uploadState.portraitName).toBe('portrait-photo.png');
    expect(uploadState.passportName).toBe('passport-copy.png');
    expect(uploadState.portraitType).toBe('image/png');
    expect(uploadState.passportType).toBe('image/png');
    expect(uploadState.portraitSize).toBeGreaterThan(0);
    expect(uploadState.passportSize).toBeGreaterThan(0);
    await expect(page.locator('#portrait-status')).toHaveText(/portrait-photo\.png/i, { timeout: 10000 });
    await expect(page.locator('#passport-status')).toHaveText(/passport-copy\.png/i, { timeout: 10000 });
  } catch (error) {
    const snippet = consoleLogs.slice(-120).join('\n');
    throw new Error(`${error.message}\n\nRecent console logs:\n${snippet}`);
  }
});

test('content script autofill uploads bundled template images when no local upload data exists', async ({ page }) => {
  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push(msg.text()));
  page.on('pageerror', error => consoleLogs.push(`PAGEERROR: ${error.message}`));

  const portraitBuffer = fs.readFileSync(path.resolve(__dirname, 'embedded-passport-photo.png'));
  const passportBuffer = fs.readFileSync(path.resolve(__dirname, 'embedded-passport-copy.png'));

  await page.addInitScript(() => {
    const mockResponse = {
      userData: {
        documents: {
          passport_photo: {
            file_name: 'embedded-passport-photo.png',
            mime_type: 'image/png',
            url: 'https://www.evisa.gov.vn/mock-assets/embedded-passport-photo.png'
          },
          passport_copy: {
            file_name: 'embedded-passport-copy.png',
            mime_type: 'image/png',
            url: 'https://www.evisa.gov.vn/mock-assets/embedded-passport-copy.png'
          }
        }
      },
      fieldMappings: {
        passport_photo: { label_cn: '照片（正面）' },
        passport_copy: { label_cn: '护照复印件' }
      }
    };

    window.chrome = {
      runtime: {
        sendMessage(message, callback) {
          if (message && message.action === 'getUserData') {
            callback(mockResponse);
          } else if (message && message.action === 'getUploadDocuments') {
            callback({ documents: mockResponse.userData.documents });
          } else if (callback) {
            callback({});
          }
        },
        getURL(relativePath) {
          return `chrome-extension://mock-extension-id/${relativePath}`;
        },
        openOptionsPage() {}
      },
      storage: {
        local: {
          get(_keys, callback) {
            callback({});
          }
        }
      }
    };
  });

  await page.route('https://www.evisa.gov.vn/mock-upload-form-embedded', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: buildMockUploadHtml()
    });
  });

  await page.route('https://www.evisa.gov.vn/mock-assets/embedded-passport-photo.png', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: portraitBuffer
    });
  });

  await page.route('https://www.evisa.gov.vn/mock-assets/embedded-passport-copy.png', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: passportBuffer
    });
  });

  try {
    await page.goto('https://www.evisa.gov.vn/mock-upload-form-embedded', { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ path: path.resolve(__dirname, 'content.js') });
    await page.waitForFunction(() => typeof window.fillAllFields === 'function', null, { timeout: 15000 });

    await page.evaluate(async () => {
      await window.fillAllFields();
    });

    await page.waitForFunction(() => {
      const portrait = document.querySelector('#basic_anhMat');
      const passport = document.querySelector('#basic_anhHoChieu');
      return portrait?.files?.length === 1 && passport?.files?.length === 1;
    }, null, { timeout: 10000 });

    const uploadState = await page.evaluate(() => {
      const portrait = document.querySelector('#basic_anhMat');
      const passport = document.querySelector('#basic_anhHoChieu');
      return {
        portraitName: portrait.files[0].name,
        portraitSize: portrait.files[0].size,
        passportName: passport.files[0].name,
        passportSize: passport.files[0].size
      };
    });

    expect(uploadState.portraitName).toBe('embedded-passport-photo.png');
    expect(uploadState.passportName).toBe('embedded-passport-copy.png');
    expect(uploadState.portraitSize).toBeGreaterThan(1000);
    expect(uploadState.passportSize).toBeGreaterThan(1000);
    expect(consoleLogs.some(line => line.includes('📎 已加载本地上传文件: 2 个'))).toBe(true);
    await expect(page.locator('#portrait-status')).toHaveText(/embedded-passport-photo\.png/i, { timeout: 10000 });
    await expect(page.locator('#passport-status')).toHaveText(/embedded-passport-copy\.png/i, { timeout: 10000 });
  } catch (error) {
    const snippet = consoleLogs.slice(-160).join('\n');
    throw new Error(`${error.message}\n\nRecent console logs:\n${snippet}`);
  }
});

test('popup-selected upload files persist and content script reuses them on the form page', async ({ page, context }) => {
  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push(msg.text()));
  page.on('pageerror', error => consoleLogs.push(`PAGEERROR: ${error.message}`));

  const mockResponse = {
    userData: {
      documents: {}
    },
    fieldMappings: {
      passport_photo: { label_cn: '照片（正面）' },
      passport_copy: { label_cn: '护照复印件' }
    }
  };

  await context.addInitScript((runtimeResponse) => {
    const STORAGE_KEY = '__vhMockChromeStorage__';
    const UPLOAD_STORAGE_KEY = 'vhUploadDocuments';

    const readStore = () => {
      try {
        return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
      } catch (error) {
        return {};
      }
    };

    const writeStore = (store) => {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store || {}));
    };

    const respond = (callback, payload) => {
      window.setTimeout(() => {
        if (typeof callback === 'function') callback(payload);
      }, 0);
    };

    const buildGetResult = (keys, store) => {
      if (!keys) return { ...store };

      if (Array.isArray(keys)) {
        return keys.reduce((result, key) => {
          if (Object.prototype.hasOwnProperty.call(store, key)) {
            result[key] = store[key];
          }
          return result;
        }, {});
      }

      if (typeof keys === 'string') {
        return Object.prototype.hasOwnProperty.call(store, keys)
          ? { [keys]: store[keys] }
          : {};
      }

      if (typeof keys === 'object') {
        return Object.keys(keys).reduce((result, key) => {
          result[key] = Object.prototype.hasOwnProperty.call(store, key)
            ? store[key]
            : keys[key];
          return result;
        }, {});
      }

      return {};
    };

    const storageArea = {
      get(keys, callback) {
        respond(callback, buildGetResult(keys, readStore()));
      },
      set(items, callback) {
        const store = readStore();
        Object.assign(store, items || {});
        writeStore(store);
        respond(callback);
      },
      remove(keys, callback) {
        const store = readStore();
        const list = Array.isArray(keys) ? keys : [keys];
        list.forEach((key) => delete store[key]);
        writeStore(store);
        respond(callback);
      }
    };

    window.chrome = {
      runtime: {
        lastError: null,
        sendMessage(message, callback) {
          const store = readStore();
          const uploadDocuments = store[UPLOAD_STORAGE_KEY] || {};

          if (message?.action === 'getUserData') {
            respond(callback, runtimeResponse);
            return;
          }

          if (message?.action === 'getUploadDocuments') {
            respond(callback, { documents: uploadDocuments });
            return;
          }

          if (message?.action === 'saveUploadDocumentDataUrl' && message.key && message.payload?.data_url) {
            const nextDocuments = {
              ...uploadDocuments,
              [message.key]: {
                ...message.payload,
                size: message.payload.size || 0
              }
            };
            store[UPLOAD_STORAGE_KEY] = nextDocuments;
            writeStore(store);
            respond(callback, { success: true, documents: nextDocuments });
            return;
          }

          if (message?.action === 'saveUploadDocument' && message.key && message.payload) {
            const nextDocuments = {
              ...uploadDocuments,
              [message.key]: message.payload
            };
            store[UPLOAD_STORAGE_KEY] = nextDocuments;
            writeStore(store);
            respond(callback, { success: true, documents: nextDocuments });
            return;
          }

          if (message?.action === 'clearUploadDocument' && message.key) {
            const nextDocuments = { ...uploadDocuments };
            delete nextDocuments[message.key];
            store[UPLOAD_STORAGE_KEY] = nextDocuments;
            writeStore(store);
            respond(callback, { success: true, documents: nextDocuments });
            return;
          }

          respond(callback, {});
        },
        openOptionsPage() {}
      },
      storage: {
        local: storageArea
      },
      tabs: {
        create() {},
        sendMessage() {}
      }
    };
  }, mockResponse);

  await page.route('https://www.evisa.gov.vn/mock-popup', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: buildMockPopupHtml()
    });
  });

  await page.route('https://www.evisa.gov.vn/mock-upload-form-roundtrip', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: buildMockUploadHtml()
    });
  });

  try {
    await page.goto('https://www.evisa.gov.vn/mock-popup', { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ path: path.resolve(__dirname, 'popup.js') });

    await page.setInputFiles('#passportPhotoInput', path.resolve(__dirname, 'icon128.png'));
    await expect(page.locator('#passportPhotoStatus')).toHaveText(/已保存: icon128\.png/i, { timeout: 10000 });

    await page.setInputFiles('#passportCopyInput', path.resolve(__dirname, 'icon48.png'));
    await expect(page.locator('#passportCopyStatus')).toHaveText(/已保存: icon48\.png/i, { timeout: 10000 });

    await page.waitForFunction(() => {
      try {
        const store = JSON.parse(window.localStorage.getItem('__vhMockChromeStorage__') || '{}');
        const docs = store.vhUploadDocuments || {};
        return !!docs.passport_photo && !!docs.passport_copy;
      } catch (error) {
        return false;
      }
    }, null, { timeout: 10000 });

    await page.goto('https://www.evisa.gov.vn/mock-upload-form-roundtrip', { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ path: path.resolve(__dirname, 'content.js') });
    await page.waitForFunction(() => typeof window.fillAllFields === 'function', null, { timeout: 15000 });

    await page.evaluate(async () => {
      await window.fillAllFields();
    });

    await page.waitForFunction(() => {
      const portrait = document.querySelector('#basic_anhMat');
      const passport = document.querySelector('#basic_anhHoChieu');
      return (
        portrait?.files?.length === 1 &&
        passport?.files?.length === 1 &&
        portrait.files[0].name === 'icon128.png' &&
        passport.files[0].name === 'icon48.png'
      );
    }, null, { timeout: 10000 });

    const loadedUploadLogFound = consoleLogs.some(line => line.includes('📎 已加载本地上传文件: 2 个'));
    expect(loadedUploadLogFound).toBe(true);
    await expect(page.locator('#portrait-status')).toHaveText(/icon128\.png/i, { timeout: 10000 });
    await expect(page.locator('#passport-status')).toHaveText(/icon48\.png/i, { timeout: 10000 });
  } catch (error) {
    const snippet = consoleLogs.slice(-160).join('\n');
    throw new Error(`${error.message}\n\nRecent console logs:\n${snippet}`);
  }
});

test('manual file selection on the form page is remembered and reused on the next autofill run', async ({ page, context }) => {
  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push(msg.text()));
  page.on('pageerror', error => consoleLogs.push(`PAGEERROR: ${error.message}`));

  const mockResponse = {
    userData: {
      documents: {}
    },
    fieldMappings: {
      passport_photo: { label_cn: '照片（正面）' },
      passport_copy: { label_cn: '护照复印件' }
    }
  };

  await context.addInitScript((runtimeResponse) => {
    const STORAGE_KEY = '__vhMockChromeStorage__';
    const UPLOAD_STORAGE_KEY = 'vhUploadDocuments';

    const readStore = () => {
      try {
        return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
      } catch (error) {
        return {};
      }
    };

    const writeStore = (store) => {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store || {}));
    };

    const respond = (callback, payload) => {
      window.setTimeout(() => {
        if (typeof callback === 'function') callback(payload);
      }, 0);
    };

    const buildGetResult = (keys, store) => {
      if (!keys) return { ...store };

      if (Array.isArray(keys)) {
        return keys.reduce((result, key) => {
          if (Object.prototype.hasOwnProperty.call(store, key)) {
            result[key] = store[key];
          }
          return result;
        }, {});
      }

      if (typeof keys === 'string') {
        return Object.prototype.hasOwnProperty.call(store, keys)
          ? { [keys]: store[keys] }
          : {};
      }

      if (typeof keys === 'object') {
        return Object.keys(keys).reduce((result, key) => {
          result[key] = Object.prototype.hasOwnProperty.call(store, key)
            ? store[key]
            : keys[key];
          return result;
        }, {});
      }

      return {};
    };

    const storageArea = {
      get(keys, callback) {
        respond(callback, buildGetResult(keys, readStore()));
      },
      set(items, callback) {
        const store = readStore();
        Object.assign(store, items || {});
        writeStore(store);
        respond(callback);
      },
      remove(keys, callback) {
        const store = readStore();
        const list = Array.isArray(keys) ? keys : [keys];
        list.forEach((key) => delete store[key]);
        writeStore(store);
        respond(callback);
      }
    };

    window.chrome = {
      runtime: {
        lastError: null,
        getURL(path) {
          return `chrome-extension://mock-extension-id/${path}`;
        },
        sendMessage(message, callback) {
          const store = readStore();
          const uploadDocuments = store[UPLOAD_STORAGE_KEY] || {};

          if (message?.action === 'getUserData') {
            respond(callback, runtimeResponse);
            return;
          }

          if (message?.action === 'getUploadDocuments') {
            respond(callback, { documents: uploadDocuments });
            return;
          }

          if (message?.action === 'saveUploadDocumentDataUrl' && message.key && message.payload?.data_url) {
            const nextDocuments = {
              ...uploadDocuments,
              [message.key]: {
                ...message.payload,
                size: message.payload.size || 0
              }
            };
            store[UPLOAD_STORAGE_KEY] = nextDocuments;
            writeStore(store);
            respond(callback, { success: true, documents: nextDocuments });
            return;
          }

          if (message?.action === 'saveUploadDocument' && message.key && message.payload) {
            const nextDocuments = {
              ...uploadDocuments,
              [message.key]: message.payload
            };
            store[UPLOAD_STORAGE_KEY] = nextDocuments;
            writeStore(store);
            respond(callback, { success: true, documents: nextDocuments });
            return;
          }

          if (message?.action === 'clearUploadDocument' && message.key) {
            const nextDocuments = { ...uploadDocuments };
            delete nextDocuments[message.key];
            store[UPLOAD_STORAGE_KEY] = nextDocuments;
            writeStore(store);
            respond(callback, { success: true, documents: nextDocuments });
            return;
          }

          if (message?.action === 'openUploadPanel') {
            respond(callback, { success: true });
            return;
          }

          respond(callback, {});
        },
        openOptionsPage() {}
      },
      storage: {
        local: storageArea
      },
      tabs: {
        create() {},
        sendMessage() {}
      }
    };
  }, mockResponse);

  await page.route('https://www.evisa.gov.vn/mock-upload-form-remembers', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: buildMockUploadHtml()
    });
  });

  try {
    await page.goto('https://www.evisa.gov.vn/mock-upload-form-remembers', { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ path: path.resolve(__dirname, 'content.js') });
    await page.waitForFunction(() => typeof window.detectAndLabelFields === 'function', null, { timeout: 15000 });
    await page.evaluate(() => {
      window.detectAndLabelFields();
    });

    await page.setInputFiles('#basic_anhMat', path.resolve(__dirname, 'icon128.png'));
    await page.setInputFiles('#basic_anhHoChieu', path.resolve(__dirname, 'icon48.png'));

    await page.waitForFunction(() => {
      try {
        const store = JSON.parse(window.localStorage.getItem('__vhMockChromeStorage__') || '{}');
        const docs = store.vhUploadDocuments || {};
        return !!docs.passport_photo && !!docs.passport_copy;
      } catch (error) {
        return false;
      }
    }, null, { timeout: 10000 });

    await page.goto('https://www.evisa.gov.vn/mock-upload-form-remembers', { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ path: path.resolve(__dirname, 'content.js') });
    await page.waitForFunction(() => typeof window.fillAllFields === 'function', null, { timeout: 15000 });

    await page.evaluate(async () => {
      await window.fillAllFields();
    });

    await page.waitForFunction(() => {
      const portrait = document.querySelector('#basic_anhMat');
      const passport = document.querySelector('#basic_anhHoChieu');
      return (
        portrait?.files?.length === 1 &&
        passport?.files?.length === 1 &&
        portrait.files[0].name === 'icon128.png' &&
        passport.files[0].name === 'icon48.png'
      );
    }, null, { timeout: 10000 });

    const rememberLogFound = consoleLogs.some(line => line.includes('✅ 已记住上传文件: 照片（正面）'));
    const loadedUploadLogFound = consoleLogs.some(line => line.includes('📎 已加载本地上传文件: 2 个'));
    expect(rememberLogFound).toBe(true);
    expect(loadedUploadLogFound).toBe(true);
    await expect(page.locator('#portrait-status')).toHaveText(/icon128\.png/i, { timeout: 10000 });
    await expect(page.locator('#passport-status')).toHaveText(/icon48\.png/i, { timeout: 10000 });
  } catch (error) {
    const snippet = consoleLogs.slice(-180).join('\n');
    throw new Error(`${error.message}\n\nRecent console logs:\n${snippet}`);
  }
});
