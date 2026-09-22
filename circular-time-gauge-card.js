class CircularTimeGaugeCard extends HTMLElement {
  static getStubConfig() {
    return {
      type: "custom:circular-time-gauge-card",
      entity: "number.kitchen_pendant_on_gauge",
      name: "Turn on",
      min: 0,
      max: 1425,
      step: 15,
    };
  }

  setConfig(config) {
    if (!config) throw new Error("Invalid configuration");
    if (!config.entity) throw new Error("Please define entity");
    this._config = {
      min: 0,
      max: 1425,
      step: 15,
      name: "",
      ...config,
    };
    this._value = this._config.min;
    this._dragging = false;
    if (!this._root) this._build();
    if (this._nameEl) this._nameEl.textContent = this._config.name || "";
    this._updateUI();
  }

  set hass(hass) {
    this._hass = hass;
    const st = hass && hass.states && hass.states[this._config.entity];
    if (!st) return;
    const v = Number(st.state);
    if (!Number.isFinite(v)) return;
    if (!this._dragging && v !== this._value) {
      this._value = this._clamp(v);
      this._updateUI();
    }
  }

  getCardSize() { return 5; }

  _clamp(v) {
    const { min, max, step } = this._config;
    let x = Math.min(max, Math.max(min, Number(v) || min));
    x = Math.round(x / step) * step;
    return Math.min(max, Math.max(min, x));
  }

  _fmt(mins) {
    const m = ((Math.round(mins) % 1440) + 1440) % 1440;
    let h = Math.floor(m / 60);
    const mm = m % 60;
    const ap = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    return h + ":" + String(mm).padStart(2, "0") + " " + ap;
  }

  _angleForValue(v) {
    const { min, max } = this._config;
    const t = (v - min) / (max - min || 1);
    return -Math.PI + t * Math.PI;
  }

  _valueForAngle(ang) {
    let a = ang;
    if (a > 0) a = 0;
    if (a < -Math.PI) a = -Math.PI;
    const t = (a + Math.PI) / Math.PI;
    const { min, max } = this._config;
    return this._clamp(min + t * (max - min));
  }

  _pointerAngle(evt) {
    const svg = this._svg;
    const rect = svg.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height * (50 / 62);
    return Math.atan2(evt.clientY - cy, evt.clientX - cx);
  }

  _setValue(v, commit) {
    this._value = this._clamp(v);
    this._updateUI();
    if (commit && this._hass) {
      this._hass.callService("number", "set_value", {
        entity_id: this._config.entity,
        value: this._value,
      });
    }
  }

  _updateUI() {
    if (!this._needle || !this._timeEl) return;
    const ang = this._angleForValue(this._value);
    const r = 38;
    const x = 50 + r * Math.cos(ang);
    const y = 50 + r * Math.sin(ang);
    this._needle.setAttribute("cx", String(x));
    this._needle.setAttribute("cy", String(y));
    const sx = 50 + r * Math.cos(-Math.PI);
    const sy = 50 + r * Math.sin(-Math.PI);
    this._arcActive.setAttribute(
      "d",
      "M " + sx + " " + sy + " A " + r + " " + r + " 0 0 1 " + x + " " + y
    );
    this._timeEl.textContent = this._fmt(this._value);
  }

  _bindDrag() {
    const onMove = (ev) => {
      if (!this._dragging) return;
      ev.preventDefault();
      const e = ev.touches ? ev.touches[0] : ev;
      let a = this._pointerAngle(e);
      if (a > 0 && a < Math.PI / 2) a = 0;
      else if (a >= Math.PI / 2) a = -Math.PI;
      this._setValue(this._valueForAngle(a), false);
    };
    const onUp = () => {
      if (!this._dragging) return;
      this._dragging = false;
      this._setValue(this._value, true);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
    const onDown = (ev) => {
      this._dragging = true;
      const e = ev.touches ? ev.touches[0] : ev;
      let a = this._pointerAngle(e);
      if (a > 0 && a < Math.PI / 2) a = 0;
      else if (a >= Math.PI / 2) a = -Math.PI;
      this._setValue(this._valueForAngle(a), false);
      window.addEventListener("pointermove", onMove, { passive: false });
      window.addEventListener("pointerup", onUp);
      window.addEventListener("touchmove", onMove, { passive: false });
      window.addEventListener("touchend", onUp);
      ev.preventDefault();
    };
    this._hit.addEventListener("pointerdown", onDown);
    this._hit.addEventListener("touchstart", onDown, { passive: false });
  }

  _build() {
    this._root = this.attachShadow({ mode: "open" });
    this._root.innerHTML =
      "<style>" +
      ":host{display:block;}" +
      ".card{padding:12px;border-radius:12px;background:linear-gradient(180deg,rgba(255,193,7,.10),rgba(0,0,0,0));border:1px solid rgba(255,193,7,.28);}" +
      ".name{text-align:center;font-size:1.05rem;font-weight:600;color:var(--primary-text-color);}" +
      ".time{text-align:center;font-size:2.4rem;font-weight:700;letter-spacing:.02em;color:var(--primary-text-color);line-height:1.1;margin:4px 0 0;font-variant-numeric:tabular-nums;}" +
      "svg{width:100%;height:auto;touch-action:none;display:block;}" +
      ".track{fill:none;stroke:rgba(255,193,7,.22);stroke-width:10;stroke-linecap:round;}" +
      ".active{fill:none;stroke:#ffc107;stroke-width:10;stroke-linecap:round;}" +
      ".thumb{fill:#fff;stroke:#ffc107;stroke-width:3;}" +
      ".ends{font-size:7px;fill:var(--secondary-text-color);}" +
      ".hit{fill:transparent;stroke:transparent;stroke-width:28;cursor:pointer;}" +
      "</style>" +
      '<div class="card">' +
      '<div class="name"></div>' +
      '<div class="time">12:00 AM</div>' +
      '<svg viewBox="0 0 100 62" xmlns="http://www.w3.org/2000/svg">' +
      '<path class="track" d="M 12 50 A 38 38 0 0 1 88 50" />' +
      '<path class="active" d="M 12 50 A 38 38 0 0 1 12 50" />' +
      '<circle class="thumb" cx="12" cy="50" r="5.5" />' +
      '<path class="hit" d="M 12 50 A 38 38 0 0 1 88 50" />' +
      '<text class="ends" x="10" y="60" text-anchor="middle">12 AM</text>' +
      '<text class="ends" x="50" y="14" text-anchor="middle">12 PM</text>' +
      '<text class="ends" x="90" y="60" text-anchor="middle">12 AM</text>' +
      "</svg></div>";
    this._svg = this._root.querySelector("svg");
    this._nameEl = this._root.querySelector(".name");
    this._timeEl = this._root.querySelector(".time");
    this._arcActive = this._root.querySelector(".active");
    this._needle = this._root.querySelector(".thumb");
    this._hit = this._root.querySelector(".hit");
    this._nameEl.textContent = this._config.name || "";
    this._bindDrag();
  }
}

if (!customElements.get("circular-time-gauge-card")) {
  customElements.define("circular-time-gauge-card", CircularTimeGaugeCard);
}
window.customCards = window.customCards || [];
window.customCards.push({
  type: "circular-time-gauge-card",
  name: "Circular Time Gauge",
  description: "Large arc gauge for minutes-from-midnight with 12-hour clock readout",
});
