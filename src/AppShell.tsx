import { useState, useEffect, useMemo, useCallback, type ReactNode } from "react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from "recharts";
import { supabase } from "./lib/supabase";
import { Icon } from "./components/Icon";
import type { Producto, MovimientoStock, Transaccion, TipoTransaccion, TipoMovimiento } from "./lib/types";
import { formatARS, formatSigned, formatCompact, todayStr, monthOf, monthLabel, monthShort, shiftMonth } from "./lib/format";

const CAT_PRODUCTO = ["Materas", "Mates", "Yerberos", "Carteras", "Bolsos", "Bombillas", "Combos", "Otros"];
const CATS_INGRESO = ["Venta minorista", "Venta mayorista", "Merch corporativo B2B", "Otro"];
const CATS_EGRESO = ["Costo de producción / insumos", "Sueldos", "Marketing/Publicidad", "Envíos", "Comisiones plataforma", "Impuestos", "Gastos fijos", "Otro"];
const MOTIVOS_MOV: Record<TipoMovimiento, string[]> = { entrada: ["Producción", "Compra", "Ajuste"], salida: ["Venta", "Ajuste", "Merma"] };
const PIE_COLORS = ["#95592C", "#B0703B", "#C99466", "#6E4A2E", "#D8B58A", "#8A6A1F", "#A9853F", "#7A5230"];

interface ProductoForm { nombre: string; categoria: string; sku: string; precioVenta: string; costoProduccion: string; umbralStockBajo: string; }
interface VinculadoForm { productoId: string; cantidad: string; }
interface TransaccionForm { fecha: string; tipo: TipoTransaccion; monto: string; categoria: string; descripcion: string; vinculados: VinculadoForm[]; descontar: boolean; }
interface MovimientoForm { productoId: string; tipo: TipoMovimiento; cantidad: string; motivo: string; fecha: string; nota: string; }

type ModalState =
  | null
  | { kind: "confirm"; title: string; message: string; onConfirm: () => void | Promise<void> }
  | { kind: "producto"; mode: "add" | "edit"; id: string | null; form: ProductoForm }
  | { kind: "transaccion"; mode: "add" | "edit"; id: string | null; form: TransaccionForm }
  | { kind: "movimiento"; mode: "add"; form: MovimientoForm };

const NAV = [
  { key: "dashboard", label: "Inicio", icon: "dashboard" as const },
  { key: "reportes", label: "Reportes", icon: "report" as const },
  { key: "transacciones", label: "Transacciones", icon: "swap" as const },
  { key: "stock", label: "Stock", icon: "box" as const },
  { key: "productos", label: "Productos", icon: "tag" as const },
];

export function AppShell({ userEmail }: { userEmail: string }) {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoStock[]>([]);
  const [transacciones, setTransacciones] = useState<Transaccion[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [view, setView] = useState("dashboard");
  const [selMonth, setSelMonth] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [toast, setToast] = useState("");

  const [fDesde, setFDesde] = useState("");
  const [fHasta, setFHasta] = useState("");
  const [fTipo, setFTipo] = useState("todos");
  const [fCat, setFCat] = useState("todas");
  const [fBusca, setFBusca] = useState("");
  const [catFiltro, setCatFiltro] = useState("todas");

  function ping(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2400);
  }

  const fetchProductos = useCallback(async () => {
    const { data, error } = await supabase.from("productos").select("*").order("nombre");
    if (error) { ping("Error al cargar productos"); return; }
    setProductos((data ?? []) as Producto[]);
  }, []);

  const fetchMovimientos = useCallback(async () => {
    const { data, error } = await supabase.from("movimientos_stock").select("*").order("fecha", { ascending: false });
    if (error) { ping("Error al cargar stock"); return; }
    setMovimientos((data ?? []) as MovimientoStock[]);
  }, []);

  const fetchTransacciones = useCallback(async () => {
    const { data, error } = await supabase.from("transacciones").select("*").order("fecha", { ascending: false });
    if (error) { ping("Error al cargar transacciones"); return; }
    setTransacciones((data ?? []) as Transaccion[]);
  }, []);

  useEffect(() => {
    (async () => {
      setLoadingData(true);
      await Promise.all([fetchProductos(), fetchMovimientos(), fetchTransacciones()]);
      setLoadingData(false);
    })();
  }, [fetchProductos, fetchMovimientos, fetchTransacciones]);

  useEffect(() => {
    if (loadingData || selMonth) return;
    const mx = transacciones.reduce((a, t) => (monthOf(t.fecha) > a ? monthOf(t.fecha) : a), monthOf(todayStr()));
    setSelMonth(mx);
  }, [loadingData, selMonth, transacciones]);

  const stockOf = useMemo(
    () => (pid: string) =>
      movimientos.reduce((s, m) => (m.producto_id !== pid ? s : s + (m.tipo === "entrada" ? m.cantidad : -m.cantidad)), 0),
    [movimientos]
  );

  const alertas = useMemo(
    () => productos.map((p) => ({ p, stock: stockOf(p.id) })).filter((x) => x.stock <= x.p.umbral_stock_bajo).sort((a, b) => a.stock - b.stock),
    [productos, stockOf]
  );

  const monthAgg = useMemo(() => {
    const acc: Record<string, { ingresos: number; egresos: number }> = {};
    transacciones.forEach((t) => {
      const k = monthOf(t.fecha);
      if (!acc[k]) acc[k] = { ingresos: 0, egresos: 0 };
      acc[k][t.tipo === "ingreso" ? "ingresos" : "egresos"] += Number(t.monto);
    });
    return acc;
  }, [transacciones]);

  function aggOf(k: string) {
    const a = monthAgg[k] || { ingresos: 0, egresos: 0 };
    return { ingresos: a.ingresos, egresos: a.egresos, resultado: a.ingresos - a.egresos };
  }

  const endMonth = useMemo(() => {
    const cur = monthOf(todayStr());
    const maxData = Object.keys(monthAgg).reduce((mx, k) => (k > mx ? k : mx), cur);
    return maxData > cur ? maxData : cur;
  }, [monthAgg]);

  const serie12 = useMemo(() => {
    const arr = [];
    for (let i = 11; i >= 0; i--) {
      const k = shiftMonth(endMonth, -i);
      const a = aggOf(k);
      arr.push({ key: k, mes: monthShort(k), Ingresos: a.ingresos, Egresos: a.egresos, Resultado: a.resultado });
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endMonth, monthAgg]);

  const historico = useMemo(
    () => Object.keys(monthAgg).sort((a, b) => (a < b ? 1 : -1)).map((k) => ({ key: k, ...aggOf(k) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [monthAgg]
  );

  const pieEgresos = useMemo(() => {
    if (!selMonth) return [];
    const acc: Record<string, number> = {};
    transacciones.forEach((t) => {
      if (t.tipo === "egreso" && monthOf(t.fecha) === selMonth) acc[t.categoria] = (acc[t.categoria] || 0) + Number(t.monto);
    });
    return Object.keys(acc).map((name) => ({ name, value: acc[name] })).sort((a, b) => b.value - a.value);
  }, [transacciones, selMonth]);

  const txnFiltradas = useMemo(
    () =>
      transacciones
        .filter((t) => {
          if (fDesde && t.fecha < fDesde) return false;
          if (fHasta && t.fecha > fHasta) return false;
          if (fTipo !== "todos" && t.tipo !== fTipo) return false;
          if (fCat !== "todas" && t.categoria !== fCat) return false;
          if (fBusca && !((t.descripcion || "") + " " + t.categoria).toLowerCase().includes(fBusca.toLowerCase())) return false;
          return true;
        })
        .sort((a, b) => (a.fecha < b.fecha ? 1 : -1)),
    [transacciones, fDesde, fHasta, fTipo, fCat, fBusca]
  );

  /* ----- CRUD transacciones ----- */
  function openTxn(tipo?: TipoTransaccion, txn?: Transaccion) {
    setModal({
      kind: "transaccion",
      mode: txn ? "edit" : "add",
      id: txn ? txn.id : null,
      form: txn
        ? { fecha: txn.fecha, tipo: txn.tipo, monto: String(txn.monto), categoria: txn.categoria, descripcion: txn.descripcion || "", vinculados: [], descontar: false }
        : { fecha: todayStr(), tipo: tipo || "egreso", monto: "", categoria: (tipo === "ingreso" ? CATS_INGRESO : CATS_EGRESO)[0], descripcion: "", vinculados: [], descontar: tipo === "ingreso" },
    });
  }

  function patchTxnForm(patch: Partial<TransaccionForm>) {
    setModal((m) => (m && m.kind === "transaccion" ? { ...m, form: { ...m.form, ...patch } } : m));
  }

  async function saveTxn() {
    if (modal?.kind !== "transaccion") return;
    const f = modal.form;
    const monto = parseFloat(f.monto);
    if (!f.fecha || !monto || monto <= 0) { ping("Completá fecha y un monto válido"); return; }
    const vinc = (f.vinculados || []).filter((v) => v.productoId && Number(v.cantidad) > 0);
    const payload = { fecha: f.fecha, tipo: f.tipo, monto, categoria: f.categoria, descripcion: (f.descripcion || "").trim() || null, origen: "manual" as const };

    if (modal.mode === "edit" && modal.id) {
      const { error } = await supabase.from("transacciones").update(payload).eq("id", modal.id);
      if (error) { ping("Error al actualizar"); return; }
    } else {
      const { error } = await supabase.from("transacciones").insert(payload);
      if (error) { ping("Error al guardar"); return; }
      if (f.tipo === "ingreso" && f.descontar && vinc.length) {
        const movs = vinc.map((v) => ({
          producto_id: v.productoId, tipo: "salida" as const, cantidad: Number(v.cantidad),
          fecha: f.fecha, motivo: "Venta", nota: (f.descripcion || "").trim() || null,
        }));
        const { error: movError } = await supabase.from("movimientos_stock").insert(movs);
        if (movError) ping("Venta guardada, pero hubo un error al descontar el stock");
        await fetchMovimientos();
      }
    }
    await fetchTransacciones();
    setModal(null);
    ping(modal.mode === "edit" ? "Movimiento actualizado" : "Movimiento registrado");
  }

  async function deleteTxn(id: string) {
    askDelete("Eliminar movimiento", "Se borrará este ingreso/egreso. Esta acción no se puede deshacer.", async () => {
      const { error } = await supabase.from("transacciones").delete().eq("id", id);
      if (error) { ping("Error al eliminar"); return; }
      await fetchTransacciones();
      setModal(null);
      ping("Movimiento eliminado");
    });
  }

  /* ----- CRUD productos ----- */
  function openProducto(p?: Producto) {
    setModal({
      kind: "producto",
      mode: p ? "edit" : "add",
      id: p ? p.id : null,
      form: p
        ? { nombre: p.nombre, categoria: p.categoria, sku: p.sku || "", precioVenta: String(p.precio_venta), costoProduccion: String(p.costo_produccion), umbralStockBajo: String(p.umbral_stock_bajo) }
        : { nombre: "", categoria: CAT_PRODUCTO[0], sku: "", precioVenta: "", costoProduccion: "", umbralStockBajo: "3" },
    });
  }

  function patchProductoForm(patch: Partial<ProductoForm>) {
    setModal((m) => (m && m.kind === "producto" ? { ...m, form: { ...m.form, ...patch } } : m));
  }

  async function saveProducto() {
    if (modal?.kind !== "producto") return;
    const f = modal.form;
    if (!(f.nombre || "").trim()) { ping("Poné un nombre al producto"); return; }
    const payload = {
      nombre: f.nombre.trim(), categoria: f.categoria, sku: (f.sku || "").trim() || null,
      precio_venta: parseFloat(f.precioVenta) || 0, costo_produccion: parseFloat(f.costoProduccion) || 0,
      umbral_stock_bajo: parseInt(f.umbralStockBajo) || 0,
    };
    if (modal.mode === "edit" && modal.id) {
      const { error } = await supabase.from("productos").update(payload).eq("id", modal.id);
      if (error) { ping("Error al actualizar producto"); return; }
    } else {
      const { error } = await supabase.from("productos").insert({ ...payload, origen: "manual" });
      if (error) { ping("Error al guardar producto"); return; }
    }
    await fetchProductos();
    setModal(null);
    ping(modal.mode === "edit" ? "Producto actualizado" : "Producto agregado");
  }

  async function deleteProducto(id: string) {
    askDelete("Eliminar producto", "Se borrará el producto y todos sus movimientos de stock.", async () => {
      const { error } = await supabase.from("productos").delete().eq("id", id);
      if (error) { ping("Error al eliminar"); return; }
      await Promise.all([fetchProductos(), fetchMovimientos()]);
      setModal(null);
      ping("Producto eliminado");
    });
  }

  /* ----- CRUD movimientos ----- */
  function openMov(p?: Producto) {
    setModal({
      kind: "movimiento",
      mode: "add",
      form: { productoId: p ? p.id : productos[0]?.id ?? "", tipo: "entrada", cantidad: "", motivo: "Producción", fecha: todayStr(), nota: "" },
    });
  }

  function patchMovForm(patch: Partial<MovimientoForm>) {
    setModal((m) => (m && m.kind === "movimiento" ? { ...m, form: { ...m.form, ...patch } } : m));
  }

  async function saveMov() {
    if (modal?.kind !== "movimiento") return;
    const f = modal.form;
    const cant = parseInt(f.cantidad);
    if (!f.productoId || !cant || cant <= 0) { ping("Elegí producto y una cantidad válida"); return; }
    const { error } = await supabase.from("movimientos_stock").insert({
      producto_id: f.productoId, tipo: f.tipo, cantidad: cant, fecha: f.fecha, motivo: f.motivo, nota: (f.nota || "").trim() || null,
    });
    if (error) { ping("Error al registrar el movimiento"); return; }
    await fetchMovimientos();
    setModal(null);
    ping("Movimiento de stock registrado");
  }

  function askDelete(title: string, message: string, fn: () => void | Promise<void>) {
    setModal({ kind: "confirm", title, message, onConfirm: fn });
  }

  /* ----- export ----- */
  function download(filename: string, text: string) {
    const blob = new Blob(["﻿" + text], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }
  function csvCell(v: unknown) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; }
  function exportTxnCSV() {
    const rows: (string | number)[][] = [["Fecha", "Tipo", "Categoria", "Descripcion", "Monto"]];
    transacciones.slice().sort((a, b) => (a.fecha < b.fecha ? -1 : 1)).forEach((t) => rows.push([t.fecha, t.tipo, t.categoria, t.descripcion || "", t.monto]));
    download("timbo-transacciones.csv", rows.map((r) => r.map(csvCell).join(";")).join("\n"));
    ping("CSV de transacciones exportado");
  }
  function exportStockCSV() {
    const rows: (string | number)[][] = [["Producto", "Categoria", "SKU", "Stock", "PrecioVenta", "CostoProduccion", "Margen"]];
    productos.forEach((p) => rows.push([p.nombre, p.categoria, p.sku || "", stockOf(p.id), p.precio_venta, p.costo_produccion, p.precio_venta - p.costo_produccion]));
    download("timbo-stock.csv", rows.map((r) => r.map(csvCell).join(";")).join("\n"));
    ping("CSV de stock exportado");
  }
  function exportBackup() {
    download("timbo-respaldo.json", JSON.stringify({ productos, movimientos, transacciones }, null, 2));
    ping("Respaldo exportado");
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  if (loadingData || !selMonth) {
    return <div className="timbo-app"><div className="t-loading">Cargando Timbó Gestión…</div></div>;
  }

  const mAgg = aggOf(selMonth);
  const prevAgg = aggOf(shiftMonth(selMonth, -1));
  const delta = mAgg.resultado - prevAgg.resultado;
  const hasPrev = monthAgg[shiftMonth(selMonth, -1)] != null;

  const MonthNav = () => (
    <div className="t-month-nav">
      <button className="t-icon-btn" style={{ border: "none", background: "none" }} onClick={() => setSelMonth(shiftMonth(selMonth, -1))} aria-label="Mes anterior"><Icon name="chevL" /></button>
      <span className="lbl">{monthLabel(selMonth)}</span>
      <button className="t-icon-btn" style={{ border: "none", background: "none" }} onClick={() => setSelMonth(shiftMonth(selMonth, 1))} aria-label="Mes siguiente"><Icon name="chevR" /></button>
    </div>
  );

  function renderDashboard() {
    const positivo = mAgg.resultado >= 0;
    const last5 = transacciones.slice().sort((a, b) => (a.fecha < b.fecha ? 1 : -1)).slice(0, 5);
    return (
      <div className="stack-lg">
        <div className="t-page-head">
          <div><h1 className="t-page-title">Resumen del negocio</h1><p className="t-page-sub">Cómo viene el mes de un vistazo</p></div>
          <MonthNav />
        </div>

        <div className="t-hero">
          <div className="t-hero-eyebrow">Resultado de {monthLabel(selMonth!)}</div>
          <div className="t-hero-num t-serif t-num" style={{ color: positivo ? "var(--green)" : "var(--red)" }}>{formatSigned(mAgg.resultado)}</div>
          <div className="t-hero-verdict" style={{ color: positivo ? "var(--green)" : "var(--red)" }}>
            {positivo ? "Mes en ganancia" : "Mes en pérdida"}
            {hasPrev && <span style={{ color: "var(--muted)", fontWeight: 500, marginLeft: 8 }}>{delta >= 0 ? "▲" : "▼"} {formatARS(Math.abs(delta))} vs {monthLabel(shiftMonth(selMonth!, -1))}</span>}
          </div>
          <div className="t-hero-split">
            <div className="t-hero-stat"><div className="k">Ingresos</div><div className="v" style={{ color: "var(--green)" }}><Icon name="up" size={18} /> {formatARS(mAgg.ingresos)}</div></div>
            <div className="t-hero-stat"><div className="k">Egresos</div><div className="v" style={{ color: "var(--red)" }}><Icon name="down" size={18} /> {formatARS(mAgg.egresos)}</div></div>
          </div>
        </div>

        <div className="t-row t-wrap">
          <button className="t-btn t-btn-primary" onClick={() => openTxn("ingreso")}><Icon name="plus" size={16} /> Registrar venta</button>
          <button className="t-btn" onClick={() => openTxn("egreso")}><Icon name="plus" size={16} /> Registrar gasto</button>
          <button className="t-btn" onClick={() => openMov()}><Icon name="box" size={16} /> Movimiento de stock</button>
          <button className="t-btn" onClick={() => openProducto()}><Icon name="tag" size={16} /> Agregar producto</button>
        </div>

        {alertas.length > 0 && (
          <div className="t-alert">
            <Icon name="alert" size={20} />
            <div><strong>Stock para revisar.</strong> {alertas.map((a, i) => <span key={a.p.id}>{a.p.nombre} ({a.stock <= 0 ? "sin stock" : a.stock + " u."}){i < alertas.length - 1 ? " · " : ""}</span>)}</div>
          </div>
        )}

        <div className="t-grid-2">
          <div className="t-card">
            <div className="t-card-title">Ingresos vs egresos · últimos 12 meses</div>
            <div className="t-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={serie12} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EADFCD" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#897A69" }} tickLine={false} axisLine={{ stroke: "#E7DCCB" }} />
                  <YAxis tickFormatter={formatCompact} tick={{ fontSize: 11, fill: "#897A69" }} tickLine={false} axisLine={false} width={52} />
                  <Tooltip formatter={(v, n) => [formatARS(Number(v)), String(n)]} contentStyle={{ borderRadius: 10, border: "1px solid #E7DCCB", fontSize: 13 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Ingresos" fill="#2E7A52" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Egresos" fill="#B23A48" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="t-card">
            <div className="t-card-title">Resultado neto mensual</div>
            <div className="t-chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={serie12} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EADFCD" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#897A69" }} tickLine={false} axisLine={{ stroke: "#E7DCCB" }} />
                  <YAxis tickFormatter={formatCompact} tick={{ fontSize: 11, fill: "#897A69" }} tickLine={false} axisLine={false} width={52} />
                  <Tooltip formatter={(v) => [formatARS(Number(v)), "Resultado"]} contentStyle={{ borderRadius: 10, border: "1px solid #E7DCCB", fontSize: 13 }} />
                  <ReferenceLine y={0} stroke="#C9B89E" />
                  <Line type="monotone" dataKey="Resultado" stroke="#8F5728" strokeWidth={2.5} dot={{ r: 3, fill: "#8F5728" }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="t-grid-2">
          <div className="t-card">
            <div className="t-card-title">Egresos por categoría · {monthLabel(selMonth!)}</div>
            {pieEgresos.length === 0 ? <div className="t-empty">No hay egresos cargados este mes.</div> : (
              <div className="t-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieEgresos} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={92} innerRadius={48} paddingAngle={2}>
                      {pieEgresos.map((_e, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [formatARS(Number(v)), String(n)]} contentStyle={{ borderRadius: 10, border: "1px solid #E7DCCB", fontSize: 13 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          <div className="t-card">
            <div className="t-card-title">Últimos movimientos</div>
            {last5.length === 0 ? <div className="t-empty">Todavía no cargaste movimientos.</div> : (
              <div className="stack-sm">
                {last5.map((t) => (
                  <div key={t.id} className="t-row" style={{ justifyContent: "space-between", padding: "8px 2px", borderBottom: "1px solid var(--line)" }}>
                    <div><div style={{ fontWeight: 600, fontSize: 14 }}>{t.descripcion || t.categoria}</div><div style={{ fontSize: 12.5, color: "var(--muted)" }}>{t.fecha} · {t.categoria}</div></div>
                    <div className="t-num" style={{ fontWeight: 600, color: t.tipo === "ingreso" ? "var(--green)" : "var(--red)" }}>{t.tipo === "ingreso" ? "+ " : "- "}{formatARS(t.monto)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderReportes() {
    const anio = selMonth!.slice(0, 4);
    const tot = historico.filter((h) => h.key.startsWith(anio)).reduce((a, h) => ({ ingresos: a.ingresos + h.ingresos, egresos: a.egresos + h.egresos }), { ingresos: 0, egresos: 0 });
    const resA = tot.ingresos - tot.egresos;
    return (
      <div className="stack-lg">
        <div className="t-page-head"><div><h1 className="t-page-title">Reportes mensuales</h1><p className="t-page-sub">Ganancia o pérdida mes a mes</p></div></div>
        <div className="t-grid-3">
          <div className="t-card t-kpi"><div className="k">Ingresos {anio}</div><div className="v t-num" style={{ color: "var(--green)" }}>{formatARS(tot.ingresos)}</div></div>
          <div className="t-card t-kpi"><div className="k">Egresos {anio}</div><div className="v t-num" style={{ color: "var(--red)" }}>{formatARS(tot.egresos)}</div></div>
          <div className="t-card t-kpi"><div className="k">Resultado {anio}</div><div className="v t-num" style={{ color: resA >= 0 ? "var(--green)" : "var(--red)" }}>{formatSigned(resA)}</div></div>
        </div>
        <div className="t-card">
          <div className="t-card-title">Detalle por mes</div>
          <div className="t-table-wrap">
            <table className="t-table">
              <thead><tr><th>Mes</th><th className="t-right">Ingresos</th><th className="t-right">Egresos</th><th className="t-right">Resultado</th><th>Estado</th></tr></thead>
              <tbody>
                {historico.length === 0 && <tr><td colSpan={5}><div className="t-empty">Sin datos todavía.</div></td></tr>}
                {historico.map((h) => (
                  <tr key={h.key} style={{ cursor: "pointer" }} onClick={() => { setSelMonth(h.key); setView("dashboard"); }}>
                    <td style={{ fontWeight: 600 }}>{monthLabel(h.key)}</td>
                    <td className="t-right t-num">{formatARS(h.ingresos)}</td>
                    <td className="t-right t-num">{formatARS(h.egresos)}</td>
                    <td className="t-right t-num" style={{ fontWeight: 700, color: h.resultado >= 0 ? "var(--green)" : "var(--red)" }}>{formatSigned(h.resultado)}</td>
                    <td><span className={"t-pill " + (h.resultado >= 0 ? "t-pill-green" : "t-pill-red")}>{h.resultado >= 0 ? "Ganancia" : "Pérdida"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="t-card">
          <div className="t-card-title">Evolución del resultado neto</div>
          <div className="t-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={serie12} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EADFCD" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#897A69" }} tickLine={false} axisLine={{ stroke: "#E7DCCB" }} />
                <YAxis tickFormatter={formatCompact} tick={{ fontSize: 11, fill: "#897A69" }} tickLine={false} axisLine={false} width={52} />
                <Tooltip formatter={(v) => [formatARS(Number(v)), "Resultado"]} contentStyle={{ borderRadius: 10, border: "1px solid #E7DCCB", fontSize: 13 }} />
                <ReferenceLine y={0} stroke="#C9B89E" />
                <Line type="monotone" dataKey="Resultado" stroke="#8F5728" strokeWidth={2.5} dot={{ r: 3, fill: "#8F5728" }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  }

  function renderTransacciones() {
    const catOpts = fTipo === "ingreso" ? CATS_INGRESO : fTipo === "egreso" ? CATS_EGRESO : Array.from(new Set(CATS_INGRESO.concat(CATS_EGRESO)));
    return (
      <div className="stack-lg">
        <div className="t-page-head">
          <div><h1 className="t-page-title">Transacciones</h1><p className="t-page-sub">Ingresos y egresos con fecha</p></div>
          <div className="t-row t-wrap">
            <button className="t-btn" onClick={exportTxnCSV}><Icon name="dl" size={16} /> Exportar CSV</button>
            <button className="t-btn" onClick={() => openTxn("egreso")}><Icon name="plus" size={16} /> Gasto</button>
            <button className="t-btn t-btn-primary" onClick={() => openTxn("ingreso")}><Icon name="plus" size={16} /> Venta</button>
          </div>
        </div>
        <div className="t-card flat">
          <div className="t-grid-3" style={{ gap: 12 }}>
            <div className="t-field"><label className="t-label">Desde</label><input type="date" className="t-input" value={fDesde} onChange={(e) => setFDesde(e.target.value)} /></div>
            <div className="t-field"><label className="t-label">Hasta</label><input type="date" className="t-input" value={fHasta} onChange={(e) => setFHasta(e.target.value)} /></div>
            <div className="t-field"><label className="t-label">Tipo</label><select className="t-select" value={fTipo} onChange={(e) => { setFTipo(e.target.value); setFCat("todas"); }}><option value="todos">Todos</option><option value="ingreso">Ingresos</option><option value="egreso">Egresos</option></select></div>
            <div className="t-field"><label className="t-label">Categoría</label><select className="t-select" value={fCat} onChange={(e) => setFCat(e.target.value)}><option value="todas">Todas</option>{catOpts.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
            <div className="t-field" style={{ gridColumn: "span 2" }}><label className="t-label">Buscar</label>
              <div style={{ position: "relative" }}><span style={{ position: "absolute", left: 11, top: 11, color: "var(--muted)" }}><Icon name="search" size={15} /></span>
                <input className="t-input" style={{ paddingLeft: 32 }} placeholder="Descripción o categoría" value={fBusca} onChange={(e) => setFBusca(e.target.value)} /></div>
            </div>
          </div>
        </div>
        <div className="t-card">
          <div className="t-table-wrap">
            <table className="t-table">
              <thead><tr><th>Fecha</th><th>Tipo</th><th>Categoría</th><th>Descripción</th><th className="t-right">Monto</th><th></th></tr></thead>
              <tbody>
                {txnFiltradas.length === 0 && <tr><td colSpan={6}><div className="t-empty">No hay movimientos con estos filtros.</div></td></tr>}
                {txnFiltradas.map((t) => (
                  <tr key={t.id}>
                    <td className="t-num">{t.fecha}</td>
                    <td><span className={"t-pill " + (t.tipo === "ingreso" ? "t-pill-green" : "t-pill-red")}>{t.tipo === "ingreso" ? "Ingreso" : "Egreso"}</span></td>
                    <td>{t.categoria}</td>
                    <td>{t.descripcion || <span style={{ color: "var(--muted)" }}>—</span>}</td>
                    <td className="t-right t-num" style={{ fontWeight: 600, color: t.tipo === "ingreso" ? "var(--green)" : "var(--red)" }}>{t.tipo === "ingreso" ? "+ " : "- "}{formatARS(t.monto)}</td>
                    <td><div className="t-row" style={{ justifyContent: "flex-end", gap: 6 }}><button className="t-icon-btn" onClick={() => openTxn(t.tipo, t)}><Icon name="edit" size={15} /></button><button className="t-icon-btn danger" onClick={() => deleteTxn(t.id)}><Icon name="trash" size={15} /></button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  function renderStock() {
    const lista = productos.map((p) => ({ ...p, stock: stockOf(p.id), margen: p.precio_venta - p.costo_produccion })).filter((p) => catFiltro === "todas" || p.categoria === catFiltro).sort((a, b) => a.stock - b.stock);
    const movs = movimientos.slice().sort((a, b) => (a.fecha < b.fecha ? 1 : -1)).slice(0, 12);
    const nombreProd = (id: string) => productos.find((x) => x.id === id)?.nombre ?? "Producto eliminado";
    return (
      <div className="stack-lg">
        <div className="t-page-head">
          <div><h1 className="t-page-title">Stock e inventario</h1><p className="t-page-sub">Qué hay disponible ahora</p></div>
          <div className="t-row t-wrap"><button className="t-btn" onClick={exportStockCSV}><Icon name="dl" size={16} /> Exportar CSV</button><button className="t-btn t-btn-primary" onClick={() => openMov()}><Icon name="plus" size={16} /> Movimiento</button></div>
        </div>
        {alertas.length > 0 && <div className="t-alert"><Icon name="alert" size={20} /><div><strong>{alertas.length} producto{alertas.length > 1 ? "s" : ""} con stock bajo o agotado.</strong> Conviene reponer antes de empujar ventas.</div></div>}
        <div className="t-row">
          <div className="t-field" style={{ maxWidth: 220 }}><label className="t-label">Categoría</label><select className="t-select" value={catFiltro} onChange={(e) => setCatFiltro(e.target.value)}><option value="todas">Todas</option>{CAT_PRODUCTO.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
        </div>
        <div className="t-card">
          <div className="t-table-wrap">
            <table className="t-table">
              <thead><tr><th>Producto</th><th>Categoría</th><th className="t-right">Stock</th><th>Estado</th><th className="t-right">Precio</th><th className="t-right">Costo</th><th className="t-right">Margen</th><th></th></tr></thead>
              <tbody>
                {lista.length === 0 && <tr><td colSpan={8}><div className="t-empty">No hay productos en esta categoría.</div></td></tr>}
                {lista.map((p) => {
                  const estado = p.stock <= 0 ? "agotado" : p.stock <= p.umbral_stock_bajo ? "bajo" : "ok";
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.nombre}{p.sku && <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 12.5 }}> · {p.sku}</span>}</td>
                      <td>{p.categoria}</td>
                      <td className="t-right t-num" style={{ fontWeight: 700 }}>{p.stock}</td>
                      <td><span className={"t-pill " + (estado === "ok" ? "t-pill-green" : estado === "bajo" ? "t-pill-warn" : "t-pill-red")}>{estado === "ok" ? "Disponible" : estado === "bajo" ? "Stock bajo" : "Agotado"}</span></td>
                      <td className="t-right t-num">{formatARS(p.precio_venta)}</td>
                      <td className="t-right t-num" style={{ color: "var(--muted)" }}>{formatARS(p.costo_produccion)}</td>
                      <td className="t-right t-num" style={{ fontWeight: 600 }}>{formatARS(p.margen)}</td>
                      <td><div className="t-row" style={{ justifyContent: "flex-end" }}><button className="t-btn t-btn-sm" onClick={() => openMov(p)}>Mover</button></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="t-card">
          <div className="t-card-title">Movimientos recientes</div>
          <div className="t-table-wrap">
            <table className="t-table">
              <thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th>Motivo</th><th className="t-right">Cantidad</th></tr></thead>
              <tbody>
                {movs.length === 0 && <tr><td colSpan={5}><div className="t-empty">Sin movimientos.</div></td></tr>}
                {movs.map((m) => (
                  <tr key={m.id}>
                    <td className="t-num">{m.fecha}</td>
                    <td>{nombreProd(m.producto_id)}</td>
                    <td><span className={"t-pill " + (m.tipo === "entrada" ? "t-pill-green" : "t-pill-neutral")}>{m.tipo === "entrada" ? "Entrada" : "Salida"}</span></td>
                    <td>{m.motivo}{m.nota ? <span style={{ color: "var(--muted)" }}> · {m.nota}</span> : ""}</td>
                    <td className="t-right t-num" style={{ fontWeight: 600 }}>{m.tipo === "entrada" ? "+" : "-"}{m.cantidad}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  function renderProductos() {
    const lista = productos.map((p) => ({ ...p, stock: stockOf(p.id), margen: p.precio_venta - p.costo_produccion, margenPct: p.precio_venta ? ((p.precio_venta - p.costo_produccion) / p.precio_venta) * 100 : 0 }));
    return (
      <div className="stack-lg">
        <div className="t-page-head"><div><h1 className="t-page-title">Productos</h1><p className="t-page-sub">Catálogo, precios y márgenes</p></div><button className="t-btn t-btn-primary" onClick={() => openProducto()}><Icon name="plus" size={16} /> Agregar producto</button></div>
        <div className="t-card">
          <div className="t-table-wrap">
            <table className="t-table">
              <thead><tr><th>Producto</th><th>Categoría</th><th className="t-right">Precio</th><th className="t-right">Costo</th><th className="t-right">Margen</th><th className="t-right">Margen %</th><th className="t-right">Stock</th><th></th></tr></thead>
              <tbody>
                {lista.length === 0 && <tr><td colSpan={8}><div className="t-empty">Todavía no cargaste productos.</div></td></tr>}
                {lista.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.nombre}{p.sku && <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 12.5 }}> · {p.sku}</span>}</td>
                    <td>{p.categoria}</td>
                    <td className="t-right t-num">{formatARS(p.precio_venta)}</td>
                    <td className="t-right t-num" style={{ color: "var(--muted)" }}>{formatARS(p.costo_produccion)}</td>
                    <td className="t-right t-num" style={{ fontWeight: 600 }}>{formatARS(p.margen)}</td>
                    <td className="t-right t-num"><span className={"t-pill " + (p.margenPct >= 40 ? "t-pill-green" : p.margenPct >= 20 ? "t-pill-warn" : "t-pill-red")}>{p.margenPct.toFixed(0)}%</span></td>
                    <td className="t-right t-num">{p.stock}</td>
                    <td><div className="t-row" style={{ justifyContent: "flex-end", gap: 6 }}><button className="t-icon-btn" onClick={() => openProducto(p)}><Icon name="edit" size={15} /></button><button className="t-icon-btn danger" onClick={() => deleteProducto(p.id)}><Icon name="trash" size={15} /></button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  function renderModal() {
    if (!modal) return null;

    if (modal.kind === "confirm") {
      return (
        <div className="t-overlay" onClick={() => setModal(null)}>
          <div className="t-modal sm" onClick={(e) => e.stopPropagation()}>
            <div className="t-modal-head"><div className="t-modal-title">{modal.title}</div><button className="t-icon-btn" onClick={() => setModal(null)}><Icon name="x" size={16} /></button></div>
            <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 20 }}>{modal.message}</p>
            <div className="t-row" style={{ justifyContent: "flex-end" }}><button className="t-btn" onClick={() => setModal(null)}>Cancelar</button><button className="t-btn t-btn-danger" onClick={modal.onConfirm}>Eliminar</button></div>
          </div>
        </div>
      );
    }

    if (modal.kind === "transaccion") {
      const f = modal.form;
      const cats = f.tipo === "ingreso" ? CATS_INGRESO : CATS_EGRESO;
      return (
        <div className="t-overlay" onClick={() => setModal(null)}>
          <div className="t-modal" onClick={(e) => e.stopPropagation()}>
            <div className="t-modal-head"><div className="t-modal-title">{modal.mode === "edit" ? "Editar movimiento" : "Nuevo movimiento"}</div><button className="t-icon-btn" onClick={() => setModal(null)}><Icon name="x" size={16} /></button></div>
            <div className="stack-md">
              <div className="t-toggle">
                <button className={f.tipo === "ingreso" ? "on-in" : ""} onClick={() => patchTxnForm({ tipo: "ingreso", categoria: CATS_INGRESO[0] })}>Ingreso</button>
                <button className={f.tipo === "egreso" ? "on-eg" : ""} onClick={() => patchTxnForm({ tipo: "egreso", categoria: CATS_EGRESO[0] })}>Egreso</button>
              </div>
              <div className="t-grid-2" style={{ gap: 12 }}>
                <div className="t-field"><label className="t-label">Fecha</label><input type="date" className="t-input" value={f.fecha} onChange={(e) => patchTxnForm({ fecha: e.target.value })} /></div>
                <div className="t-field"><label className="t-label">Monto (ARS)</label><input type="number" min="0" inputMode="decimal" className="t-input" placeholder="0" value={f.monto} onChange={(e) => patchTxnForm({ monto: e.target.value })} /></div>
              </div>
              <div className="t-field"><label className="t-label">Categoría</label><select className="t-select" value={f.categoria} onChange={(e) => patchTxnForm({ categoria: e.target.value })}>{cats.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
              <div className="t-field"><label className="t-label">Descripción</label><input className="t-input" placeholder="Ej: 2 Materas Chocolate" value={f.descripcion} onChange={(e) => patchTxnForm({ descripcion: e.target.value })} /></div>
              {f.tipo === "ingreso" && modal.mode === "add" && (
                <div className="t-card flat" style={{ padding: 14 }}>
                  <label className="t-row" style={{ gap: 8, cursor: "pointer", fontSize: 14, fontWeight: 600 }}><input type="checkbox" checked={f.descontar} onChange={(e) => patchTxnForm({ descontar: e.target.checked })} /> Descontar del stock al guardar</label>
                  {f.descontar && (
                    <div className="stack-sm" style={{ marginTop: 12 }}>
                      {(f.vinculados || []).map((v, i) => (
                        <div className="t-row" key={i} style={{ gap: 8 }}>
                          <select className="t-select" value={v.productoId} onChange={(e) => { const arr = f.vinculados.slice(); arr[i] = { ...arr[i], productoId: e.target.value }; patchTxnForm({ vinculados: arr }); }}>
                            <option value="">Elegí producto…</option>{productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                          </select>
                          <input type="number" min="1" className="t-input" style={{ maxWidth: 90 }} placeholder="Cant." value={v.cantidad} onChange={(e) => { const arr = f.vinculados.slice(); arr[i] = { ...arr[i], cantidad: e.target.value }; patchTxnForm({ vinculados: arr }); }} />
                          <button className="t-icon-btn danger" onClick={() => patchTxnForm({ vinculados: f.vinculados.filter((_, j) => j !== i) })}><Icon name="x" size={15} /></button>
                        </div>
                      ))}
                      <button className="t-btn t-btn-sm" onClick={() => patchTxnForm({ vinculados: (f.vinculados || []).concat([{ productoId: "", cantidad: "" }]) })}><Icon name="plus" size={14} /> Agregar producto</button>
                    </div>
                  )}
                </div>
              )}
              <div className="t-row" style={{ justifyContent: "flex-end" }}><button className="t-btn" onClick={() => setModal(null)}>Cancelar</button><button className="t-btn t-btn-primary" onClick={saveTxn}><Icon name="check" size={16} /> Guardar</button></div>
            </div>
          </div>
        </div>
      );
    }

    if (modal.kind === "producto") {
      const f = modal.form;
      const margen = (parseFloat(f.precioVenta) || 0) - (parseFloat(f.costoProduccion) || 0);
      const pct = parseFloat(f.precioVenta) ? (margen / parseFloat(f.precioVenta)) * 100 : 0;
      return (
        <div className="t-overlay" onClick={() => setModal(null)}>
          <div className="t-modal" onClick={(e) => e.stopPropagation()}>
            <div className="t-modal-head"><div className="t-modal-title">{modal.mode === "edit" ? "Editar producto" : "Nuevo producto"}</div><button className="t-icon-btn" onClick={() => setModal(null)}><Icon name="x" size={16} /></button></div>
            <div className="stack-md">
              <div className="t-field"><label className="t-label">Nombre</label><input className="t-input" placeholder="Ej: Matera Timbó Chocolate" value={f.nombre} onChange={(e) => patchProductoForm({ nombre: e.target.value })} /></div>
              <div className="t-grid-2" style={{ gap: 12 }}>
                <div className="t-field"><label className="t-label">Categoría</label><select className="t-select" value={f.categoria} onChange={(e) => patchProductoForm({ categoria: e.target.value })}>{CAT_PRODUCTO.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
                <div className="t-field"><label className="t-label">SKU / código</label><input className="t-input" placeholder="opcional" value={f.sku} onChange={(e) => patchProductoForm({ sku: e.target.value })} /></div>
              </div>
              <div className="t-grid-2" style={{ gap: 12 }}>
                <div className="t-field"><label className="t-label">Precio de venta</label><input type="number" min="0" className="t-input" placeholder="0" value={f.precioVenta} onChange={(e) => patchProductoForm({ precioVenta: e.target.value })} /></div>
                <div className="t-field"><label className="t-label">Costo de producción</label><input type="number" min="0" className="t-input" placeholder="0" value={f.costoProduccion} onChange={(e) => patchProductoForm({ costoProduccion: e.target.value })} /></div>
              </div>
              <div className="t-field"><label className="t-label">Umbral de stock bajo</label><input type="number" min="0" className="t-input" value={f.umbralStockBajo} onChange={(e) => patchProductoForm({ umbralStockBajo: e.target.value })} /></div>
              <div className="t-card flat" style={{ padding: 14 }}><div className="t-row" style={{ justifyContent: "space-between" }}><span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>Margen unitario</span><span className="t-num" style={{ fontWeight: 700, color: margen >= 0 ? "var(--green)" : "var(--red)" }}>{formatARS(margen)} · {pct.toFixed(0)}%</span></div></div>
              <div className="t-row" style={{ justifyContent: "flex-end" }}><button className="t-btn" onClick={() => setModal(null)}>Cancelar</button><button className="t-btn t-btn-primary" onClick={saveProducto}><Icon name="check" size={16} /> Guardar</button></div>
            </div>
          </div>
        </div>
      );
    }

    if (modal.kind === "movimiento") {
      const f = modal.form;
      return (
        <div className="t-overlay" onClick={() => setModal(null)}>
          <div className="t-modal" onClick={(e) => e.stopPropagation()}>
            <div className="t-modal-head"><div className="t-modal-title">Movimiento de stock</div><button className="t-icon-btn" onClick={() => setModal(null)}><Icon name="x" size={16} /></button></div>
            <div className="stack-md">
              <div className="t-field"><label className="t-label">Producto</label><select className="t-select" value={f.productoId} onChange={(e) => patchMovForm({ productoId: e.target.value })}>{productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div>
              <div className="t-grid-2" style={{ gap: 12 }}>
                <div className="t-field"><label className="t-label">Tipo</label><select className="t-select" value={f.tipo} onChange={(e) => patchMovForm({ tipo: e.target.value as TipoMovimiento, motivo: MOTIVOS_MOV[e.target.value as TipoMovimiento][0] })}><option value="entrada">Entrada (suma stock)</option><option value="salida">Salida (resta stock)</option></select></div>
                <div className="t-field"><label className="t-label">Cantidad</label><input type="number" min="1" className="t-input" placeholder="0" value={f.cantidad} onChange={(e) => patchMovForm({ cantidad: e.target.value })} /></div>
              </div>
              <div className="t-grid-2" style={{ gap: 12 }}>
                <div className="t-field"><label className="t-label">Motivo</label><select className="t-select" value={f.motivo} onChange={(e) => patchMovForm({ motivo: e.target.value })}>{MOTIVOS_MOV[f.tipo].map((mo) => <option key={mo} value={mo}>{mo}</option>)}</select></div>
                <div className="t-field"><label className="t-label">Fecha</label><input type="date" className="t-input" value={f.fecha} onChange={(e) => patchMovForm({ fecha: e.target.value })} /></div>
              </div>
              <div className="t-field"><label className="t-label">Nota</label><input className="t-input" placeholder="opcional" value={f.nota} onChange={(e) => patchMovForm({ nota: e.target.value })} /></div>
              <div className="t-row" style={{ justifyContent: "flex-end" }}><button className="t-btn" onClick={() => setModal(null)}>Cancelar</button><button className="t-btn t-btn-primary" onClick={saveMov}><Icon name="check" size={16} /> Guardar</button></div>
            </div>
          </div>
        </div>
      );
    }

    return null;
  }

  const viewMap: Record<string, () => ReactNode> = {
    dashboard: renderDashboard, reportes: renderReportes, transacciones: renderTransacciones, stock: renderStock, productos: renderProductos,
  };

  return (
    <div className="timbo-app">
      <div className="t-shell">
        <aside className="t-sidebar">
          <div className="t-brand"><span className="t-brand-name t-serif">Timbó</span><span className="t-brand-sub">Gestión</span></div>
          <nav className="t-nav">
            {NAV.map((n) => <button key={n.key} className={"t-nav-item" + (view === n.key ? " active" : "")} onClick={() => setView(n.key)}><Icon name={n.icon} size={18} /> {n.label}</button>)}
          </nav>
          <div className="t-side-foot">
            <button className="t-nav-item" onClick={exportBackup}><Icon name="dl" size={16} /> Exportar respaldo</button>
            <div style={{ padding: "6px 12px", fontSize: 12, color: "#B6A48E", overflow: "hidden", textOverflow: "ellipsis" }}>{userEmail}</div>
            <button className="t-nav-item" onClick={handleLogout}><Icon name="logout" size={16} /> Cerrar sesión</button>
          </div>
        </aside>
        <main className="t-main">
          <header className="t-topbar"><span className="t-brand-name t-serif">Timbó</span><button className="t-btn t-btn-primary t-btn-sm" onClick={() => openTxn(view === "transacciones" ? "egreso" : "ingreso")}><Icon name="plus" size={15} /> Cargar</button></header>
          <div className="t-content">{viewMap[view]()}</div>
        </main>
      </div>
      <nav className="t-bottomnav">
        {NAV.map((n) => <button key={n.key} className={view === n.key ? "active" : ""} onClick={() => setView(n.key)}><Icon name={n.icon} size={20} /> {n.label}</button>)}
      </nav>
      {renderModal()}
      {toast && <div className="t-toast"><Icon name="check" size={16} /> {toast}</div>}
    </div>
  );
}
