/* ============================================================
   CraveCart - PasswordInput.jsx
   Password field with a show/hide toggle (same visual language
   as the legacy auth form inputs). The label is programmatically
   linked to the input and the toggle stays keyboard reachable.
   ============================================================ */

import React, { useId, useState } from 'react';

export default function PasswordInput({ label, value, onChange, placeholder, required, autoFocus }) {
  const [show, setShow] = useState(false);
  const id = useId();

  return (
    <div className="form-group">
      {label && <label htmlFor={id}>{label}</label>}
      <div className="input-wrap">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          className="form-control"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          autoFocus={autoFocus}
          autoComplete="new-password"
        />
        <button
          type="button"
          className="pw-toggle"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Hide password' : 'Show password'}
          aria-pressed={show}
        >
          {show ? '🙈' : '👁'}
        </button>
      </div>
    </div>
  );
}
