/* app.js — Vue 3 + Leaflet tennis courts viewer.
   window.COURTS is injected by build.py before this file. */
/* global Vue, L */

var GMAPS = 'https://www.google.com/maps/search/?api=1&query=';

var ATTR_LIST = [
  { key: 'lighted', color: '#f59e0b', label: 'Lighted' },
  { key: 'club', color: '#16a34a', label: 'Tennis Club' },
  { key: 'store', color: '#ea580c', label: 'Tennis Store' },
  { key: 'stringer', color: '#9333ea', label: 'Racquet Stringer' },
  { key: 'restricted', color: '#dc2626', label: 'Restricted' },
  { key: 'fee', color: '#991b1b', label: 'Fee' },
  { key: 'wall', color: '#4f46e5', label: 'Practice Wall' },
  { key: 'construction', color: '#64748b', label: 'In Construction' }
];

/* court record: {slug,name,address,lat,lng,type,numCourts,matches,
   lighted,club,store,stringer,restricted,fee,wall,construction} */

function colOf(c) {
  if (c.stringer) return '#9333ea';
  if (c.store) return '#ea580c';
  if (c.club) return '#16a34a';
  return '#2563eb';
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function markerHtml(c) {
  var bg = colOf(c);
  var border = c.lighted ? '3px solid #f59e0b' : '2px solid #fff';
  var radius = c.stringer ? '4px' : '50%';
  return '<div style="width:18px;height:18px;background:' + bg +
    ';border:' + border + ';border-radius:' + radius +
    ';box-shadow:0 1px 3px rgba(0,0,0,.3)"></div>';
}

function badgesOf(c) {
  var out = [];
  if (c.lighted) out.push('<span class="badge lit">Lighted</span>');
  if (c.club) out.push('<span class="badge club">Tennis Club</span>');
  if (c.store) out.push('<span class="badge store">Tennis Store</span>');
  if (c.stringer) out.push('<span class="badge stringer">Racquet Stringer</span>');
  if (c.restricted) out.push('<span class="badge restricted">Restricted</span>');
  if (c.fee) out.push('<span class="badge fee">Fee</span>');
  if (c.wall) out.push('<span class="badge wall">Wall</span>');
  if (c.construction) out.push('<span class="badge construction">Construction</span>');
  return out.join('');
}

function popupHtml(c) {
  var h = '<b>' + esc(c.name) + '</b>';
  h += '<div>' + (c.address ? esc(c.address) : 'No address on record') + '</div>';
  h += '<div style="margin-top:4px"><strong>' + c.numCourts +
       '</strong> court' + (c.numCourts === 1 ? '' : 's') + '</div>';
  h += '<div>' + badgesOf(c) + '</div>';
  if (c.address) {
    h += '<div style="margin-top:6px"><a href="' + GMAPS +
         encodeURIComponent(c.name + ' ' + c.address) +
         '" target="_blank" rel="noopener">Google Maps &#8599;</a></div>';
  }
  return h;
}

/* verts are arrays [lat, lng] in all helpers below (Leaflet native order). */

function polyContains(vert, verts) {
  var lat = vert[0];
  var lng = vert[1];
  var inside = false;
  var i, j, yi, xi, yj, xj;
  for (i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    yi = verts[i][0];
    xi = verts[i][1];
    yj = verts[j][0];
    xj = verts[j][1];
    if ((yi > lat) !== (yj > lat) &&
        lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function polyAreaM2(verts) {
  if (verts.length < 3) return 0;
  var R = 6371000;
  var sum = 0;
  var lat0 = 0;
  var i;
  for (i = 0; i < verts.length; i++) lat0 += verts[i][0];
  lat0 = (lat0 / verts.length) * Math.PI / 180;
  for (i = 0; i < verts.length; i++) {
    var a = verts[i];
    var b = verts[(i + 1) % verts.length];
    var yi = a[0] * R;
    var xi = a[1] * R * Math.cos(lat0);
    var yj = b[0] * R;
    var xj = b[1] * R * Math.cos(lat0);
    sum += xi * yj - xj * yi;
  }
  return Math.abs(sum) / 2;
}

function writeURL(st, center, zoom) {
  var p = new URLSearchParams();
  if (st.minCourts > 0) p.set('courts', String(st.minCourts));
  for (var i = 0; i < st.attrs.length; i++) p.set(st.attrs[i], '1');
  if (st.area && st.area.length >= 3) {
    p.set('area', st.area.map(function (v) {
      return v[0].toFixed(5) + ',' + v[1].toFixed(5);
    }).join(';'));
  }
  if (st.selSlug) p.set('loc', st.selSlug);
  if (center && zoom) {
    p.set('lat', center.lat.toFixed(5));
    p.set('lng', center.lng.toFixed(5));
    p.set('z', String(zoom));
  }
  var qs = p.toString();
  history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
}

function readURL() {
  var p = new URLSearchParams(location.search);
  var out = { minCourts: 0, attrs: [], area: null, selSlug: null, view: null };
  var n = parseInt(p.get('courts'), 10);
  if (n > 0) out.minCourts = n;
  for (var i = 0; i < ATTR_LIST.length; i++) {
    if (p.get(ATTR_LIST[i].key) === '1') out.attrs.push(ATTR_LIST[i].key);
  }
  var raw = p.get('area');
  if (raw) {
    var verts = raw.split(';').map(function (pair) {
      var parts = pair.split(',');
      return [parseFloat(parts[0]), parseFloat(parts[1])];
    }).filter(function (v) {
      return !isNaN(v[0]) && !isNaN(v[1]);
    });
    if (verts.length >= 3) out.area = verts;
  }
  if (p.get('loc')) out.selSlug = p.get('loc');
  var lat = parseFloat(p.get('lat'));
  var lng = parseFloat(p.get('lng'));
  var z = parseInt(p.get('z'), 10);
  if (!isNaN(lat) && !isNaN(lng)) {
    out.view = { lat: lat, lng: lng, z: (!isNaN(z) && z > 0) ? z : 11 };
  }
  return out;
}

Vue.createApp({
  data: function () {
    var u = readURL();
    return {
      attrList: ATTR_LIST,
      courts: window.COURTS || [],
      minCourts: u.minCourts,
      attrs: u.attrs,
      area: u.area,
      selSlug: u.selSlug,
      startView: u.view,
      map: null,
      markers: {},
      areaLayer: null
    };
  },
  computed: {
    visible: function () {
      var self = this;
      return this.courts.filter(function (c) {
        if (self.minCourts > 0 && (c.numCourts || 0) < self.minCourts) return false;
        var i;
        for (i = 0; i < self.attrs.length; i++) {
          if (!c[self.attrs[i]]) return false;
        }
        if (self.area) {
          if (c.lat == null || c.lng == null) return false;
          if (!polyContains([c.lat, c.lng], self.area)) return false;
        }
        return true;
      });
    },
    courtsLabel: function () {
      if (this.minCourts === 0) return 'Any number of courts';
      var suffix = this.minCourts === 1 ? ' court' : ' courts';
      return 'At least ' + this.minCourts + suffix;
    },
    areaKm2: function () {
      if (!this.area) return '0';
      return (polyAreaM2(this.area) / 1e6).toFixed(2);
    }
  },
  methods: {
    colOf: colOf,
    badges: badgesOf,
    mapLink: function (c) {
      return GMAPS + encodeURIComponent((c.name || '') + ' ' + (c.address || ''));
    },
    selectCourt: function (c) {
      this.selSlug = (this.selSlug === c.slug) ? null : c.slug;
      this.syncURL();
      var m = this.markers[c.slug];
      if (m && this.selSlug) {
        this.map.flyTo(m.getLatLng(), Math.max(this.map.getZoom(), 13), { duration: 0.7 });
        var self = this;
        window.setTimeout(function () {
          if (self.selSlug === c.slug) m.openPopup();
        }, 700);
      }
    },
    syncURL: function () {
      var center = this.map ? this.map.getCenter() : null;
      var zoom = this.map ? this.map.getZoom() : null;
      writeURL(this, center, zoom);
    },
    syncMarkers: function () {
      var shown = {};
      this.visible.forEach(function (c) { shown[c.slug] = true; });
      var self = this;
      Object.keys(this.markers).forEach(function (slug) {
        var m = self.markers[slug];
        var has = self.map.hasLayer(m);
        if (shown[slug] && !has) m.addTo(self.map);
        if (!shown[slug] && has) self.map.removeLayer(m);
      });
    },
    drawArea: function () {
      if (this.areaLayer && this.map) {
        this.map.removeLayer(this.areaLayer);
        this.areaLayer = null;
      }
      if (this.area && this.area.length >= 3 && this.map) {
        this.areaLayer = L.polygon(this.area, {
          color: '#2563eb',
          weight: 2,
          fillColor: '#2563eb',
          fillOpacity: 0.12
        }).addTo(this.map);
        this.map.fitBounds(this.areaLayer.getBounds(), { maxZoom: 13 });
      }
    }
  },
  watch: {
    visible: function () {
      this.syncMarkers();
      this.syncURL();
      if (this.$refs.list) this.$refs.list.scrollTop = 0;
    },
    area: function () {
      this.drawArea();
      this.syncURL();
    },
    minCourts: function () { this.syncURL(); },
    attrs: function () { this.syncURL(); }
  },
  mounted: function () {
    var self = this;
    var view = this.startView || { lat: 42.36, lng: -71.1, z: 11 };
    this.map = L.map('map').setView([view.lat, view.lng], view.z);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(this.map);

    this.courts.forEach(function (c) {
      if (c.lat == null || c.lng == null) return;
      var icon = L.divIcon({
        html: markerHtml(c),
        className: '',
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      });
      var m = L.marker([c.lat, c.lng], { icon: icon }).addTo(self.map);
      m.bindPopup(popupHtml(c));
      m.on('click', function () {
        self.selSlug = (self.selSlug === c.slug) ? null : c.slug;
        self.syncURL();
      });
      self.markers[c.slug] = m;
    });

    this.syncMarkers();
    this.drawArea();
    if (this.selSlug && this.markers[this.selSlug]) {
      var m0 = this.markers[this.selSlug];
      this.map.setView(m0.getLatLng(), 14);
      window.setTimeout(function () {
        if (self.selSlug && self.markers[self.selSlug]) {
          self.markers[self.selSlug].openPopup();
        }
      }, 400);
    }

    this.map.on('moveend', function () { self.syncURL(); });

    /* freehand area: right-click drag */
    var drawing = false;
    var verts = [];
    var line = null;
    var container = this.map.getContainer();
    container.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    function finishDrawing(commit) {
      drawing = false;
      self.map.dragging.enable();
      container.style.cursor = '';
      if (line) { self.map.removeLayer(line); line = null; }
      if (commit && verts.length >= 3) {
        self.area = verts.slice();
      }
      verts = [];
      if (commit) self.syncURL();
    }

    this.map.on('mousedown', function (e) {
      if (e.originalEvent.button !== 2) return;
      drawing = true;
      verts = [[e.latlng.lat, e.latlng.lng]];
      self.map.dragging.disable();
      container.style.cursor = 'crosshair';
      line = L.polyline([e.latlng], {
        color: '#2563eb',
        weight: 2,
        dashArray: '5,5',
        interactive: false
      }).addTo(self.map);
    });

    this.map.on('mousemove', function (e) {
      if (!drawing) return;
      verts.push([e.latlng.lat, e.latlng.lng]);
      if (line) line.setLatLngs(verts);
    });

    this.map.on('mouseup', function () {
      if (drawing) finishDrawing(true);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawing) finishDrawing(false);
    });
  }
}).mount('#app');