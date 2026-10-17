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

  static getGridOptions() {
    return {
      columns: 6,
      rows: 12,
      min_columns: 3,
      min_rows: 6,
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
      mode: "time",
      ...config,
    };
    this._percent = this._config.mode === "percent";
    this._value = this._config.min;
    this._dragging = false;
    if (!this._root) this._build();
    if (this._nameEl) this._nameEl.textContent = this._config.name || "";
    this._updateUI();
  }

  set hass(hass) {
    this._hass = hass;
    const st = hass ? (hass.states ? hass.states[this._config.entity] : null) : null;
    if (!st) return;
    const v = Number(st.state);
    if (!Number.isFinite(v)) return;
    if (!this._dragging) {
      if (v !== this._value) {
        this._value = this._clamp(v);
        this._updateUI();
      }
    }
  }

  getCardSize() {
    return 12;
  }

  getGridOptions() {
    return CircularTimeGaugeCard.getGridOptions();
  }

  _clamp(v) {
    const { min, max, step } = this._config;
    let x = Math.min(max, Math.max(min, Number(v) || min));
    x = Math.round(x / step) * step;
    return Math.min(max, Math.max(min, x));
  }

  _fmt(mins) {
    if (this._percent) return Math.round(mins) + "%";
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
    if (-Math.PI > a) a = -Math.PI;
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
    if (commit) {
      if (this._hass) {
        const domain = String(this._config.entity).split(".")[0];
        this._hass.callService(domain === "input_number" ? "input_number" : "number", "set_value", {
          entity_id: this._config.entity,
          value: this._value,
        });
      }
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
      if (a > 0) { if (Math.PI / 2 > a) a = 0; }
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
      if (a > 0) { if (Math.PI / 2 > a) a = 0; }
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

  _el(ns, name, attrs, text) {
    const node = ns
      ? document.createElementNS(ns, name)
      : document.createElement(name);
    if (attrs) {
      Object.keys(attrs).forEach((k) => node.setAttribute(k, attrs[k]));
    }
    if (text != null) node.textContent = text;
    return node;
  }

  _build() {
    const SVG = "http://www.w3.org/2000/svg";
    this._root = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent =
      ":host{display:block;height:100%;min-height:100%;box-sizing:border-box;}" +
      ".card{height:100%;min-height:100%;box-sizing:border-box;padding:clamp(10px,1.5vw,18px);border-radius:16px;" +
      "background:linear-gradient(180deg,rgba(255,193,7,.10),rgba(0,0,0,0));border:1px solid rgba(255,193,7,.28);" +
      "display:flex;flex-direction:column;}" +
      ".name{text-align:center;font-size:clamp(1.1rem,2.2vw,1.6rem);font-weight:600;color:var(--primary-text-color);flex:0 0 auto;}" +
      ".time{text-align:center;font-size:clamp(2.8rem,7vw,5rem);font-weight:700;letter-spacing:.02em;" +
      "color:var(--primary-text-color);line-height:1.05;margin:6px 0 4px;font-variant-numeric:tabular-nums;flex:0 0 auto;}" +
      ".gauge{flex:1 1 auto;min-height:0;display:flex;align-items:stretch;}" +
      "svg{width:100%;height:100%;touch-action:none;display:block;}" +
      ".track{fill:none;stroke:rgba(255,193,7,.22);stroke-width:9;stroke-linecap:round;}" +
      ".active{fill:none;stroke:#ffc107;stroke-width:9;stroke-linecap:round;}" +
      ".thumb{fill:#fff;stroke:#ffc107;stroke-width:2.5;}" +
      ".ends{font-size:6.5px;fill:var(--secondary-text-color);}" +
      ".hit{fill:transparent;stroke:transparent;stroke-width:28;cursor:pointer;}";

    const card = this._el(null, "div", { class: "card" });
    this._nameEl = this._el(null, "div", { class: "name" });
    this._timeEl = this._el(null, "div", { class: "time" }, this._percent ? "0%" : "12:00 AM");
    const gauge = this._el(null, "div", { class: "gauge" });
    this._svg = this._el(SVG, "svg", {
      viewBox: "0 0 100 62",
      preserveAspectRatio: "xMidYMid meet",
    });
    this._svg.appendChild(
      this._el(SVG, "path", {
        class: "track",
        d: "M 12 50 A 38 38 0 0 1 88 50",
      })
    );
    this._arcActive = this._el(SVG, "path", {
      class: "active",
      d: "M 12 50 A 38 38 0 0 1 12 50",
    });
    this._svg.appendChild(this._arcActive);
    this._needle = this._el(SVG, "circle", {
      class: "thumb",
      cx: "12",
      cy: "50",
      r: "5.5",
    });
    this._svg.appendChild(this._needle);
    this._hit = this._el(SVG, "path", {
      class: "hit",
      d: "M 12 50 A 38 38 0 0 1 88 50",
    });
    this._svg.appendChild(this._hit);
    this._svg.appendChild(
      this._el(SVG, "text", { class: "ends", x: "10", y: "60", "text-anchor": "middle" }, this._percent ? String(this._config.min) + "%" : "12 AM")
    );
    this._svg.appendChild(
      this._el(SVG, "text", { class: "ends", x: "50", y: "14", "text-anchor": "middle" }, this._percent ? "50%" : "12 PM")
    );
    this._svg.appendChild(
      this._el(SVG, "text", { class: "ends", x: "90", y: "60", "text-anchor": "middle" }, this._percent ? String(this._config.max) + "%" : "12 AM")
    );
    gauge.appendChild(this._svg);
    card.appendChild(this._nameEl);
    card.appendChild(this._timeEl);
    card.appendChild(gauge);
    this._root.appendChild(style);
    this._root.appendChild(card);
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
  description: "Large arc gauge for minutes-from-midnight (12-hour clock) or percent (mode: percent)",
});
