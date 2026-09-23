import { memo } from "react";
import { itemById } from "../lib/bunCollection";

function Person({ x = 0, y = 207, dress, smoking = false, camera = false, color = "#294c5c", scale = 1 }) {
  const skin = ["#f3d6bd", "#dfb96e", "#b57c59", "#704b38"][Math.floor(Math.abs(x) / 10) % 4];
  return <g data-skin-tone={skin} transform={`translate(${x} ${y}) scale(${scale})`} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="0" cy="-29" r="4" fill={skin} />
    <path d={dress ? "M-4-28Q-6-39 3-34L5-22" : "M-4-31Q0-36 4-31"} stroke="#302526" strokeWidth="3" fill="none" />
    {dress ? <path d="M-3-23H3L7-9H-7Z" fill={dress} /> : <path d="M0-22V-12" stroke={color} strokeWidth="7" />}
    <path d="M-2-10L-4-1M2-10L5-1" stroke={dress ? skin : "#353943"} strokeWidth="2.8" />
    <path d="M-4-1H-7M5-1H8" stroke="#292731" strokeWidth="2" />
    {dress && <path d="M-5-1V2M6-1V2" stroke="#292731" />}
    <path d={camera ? "M-3-22L-8-29L0-30M3-22L7-29L1-30" : smoking ? "M2-22L7-18L9-27" : "M-3-22L-7-13M3-22L7-13"} fill="none" stroke={skin} strokeWidth="2.2" />
    {camera && <g><rect x="-4" y="-32" width="9" height="6" rx="1" fill="#32363c" /><circle cx="1" cy="-29" r="2" fill="#bacbcb" /></g>}
    {smoking && <g><path d="M9-27L14-29" stroke="#fff9e9" strokeWidth="1.5" /><circle cx="14" cy="-29" r=".8" fill="#ff733a" /><path d="M15-32Q11-36 15-40T15-47" fill="none" stroke="#fff4e7" opacity=".7" /></g>}
  </g>;
}

function Paw() {
  return <g fill="#fff3df"><path d="M33 182C30 178 34 176 36 173C38 169 44 169 46 173C48 176 52 178 49 182C47 185 43 182 41 182C38 182 35 185 33 182Z" />
    <ellipse cx="30" cy="171" rx="3" ry="4" transform="rotate(-25 30 171)" /><ellipse cx="37" cy="165" rx="3" ry="4" /><ellipse cx="45" cy="165" rx="3" ry="4" /><ellipse cx="52" cy="171" rx="3" ry="4" transform="rotate(25 52 171)" /></g>;
}

function FluffyDog({ variant }) {
  const fur = ["#fff4d8", "#d5a065", "#785445", "#a5adb9"][variant];
  return <g transform="translate(40 196)" stroke="#654b39" strokeWidth=".6" aria-label="Fluffy dog">
    <path d="M-16-8Q-29-25-23-7" fill="none" stroke={fur} strokeWidth="6" />
    <g fill={fur}>{[-14, -7, 0, 7, 14].map((x) => <circle key={x} cx={x} cy="-5" r="8" />)}
      <path d="M-14-2V8H-9V0M7 0V8H12V-2" stroke={fur} strokeWidth="4" />
      {Array.from({ length: 10 }, (_, i) => <circle key={i} cx={11 + Math.cos(i * Math.PI / 5) * 8} cy={-14 + Math.sin(i * Math.PI / 5) * 8} r="4" />)}
      <circle cx="11" cy="-14" r="8" /></g>
    <circle cx="8" cy="-16" r="1.3" fill="#211c19" /><circle cx="15" cy="-16" r="1.3" fill="#211c19" />
    <ellipse cx="11.5" cy="-12" rx="2" ry="1.5" fill="#211c19" /><path d="M11-10V-7" stroke="#e88d9b" strokeWidth="2" />
    <path d="M3-4H19" stroke="#d55256" strokeWidth="2" />
  </g>;
}

function Bike({ x }) {
  return <g transform={`translate(${x} 190)`} strokeLinecap="round" strokeLinejoin="round">
    <g fill="#25262b" stroke="#a9aeb1" strokeWidth="2"><circle cx="-20" cy="7" r="10" /><circle cx="23" cy="7" r="10" /></g>
    <path d="M-20 7L-5-8L10 7H-20M10 7L17-13L23 7" fill="none" stroke="#cad3d3" strokeWidth="2.5" />
    <path d="M-10-10H2M15-13L12-22H19M-14 9H10" fill="none" stroke="#e5e4de" strokeWidth="3" />
    <ellipse cx="3" cy="-9" rx="10" ry="5" fill="#b65731" stroke="#eee5d9" />
    <path d="M-6-1L0 5L6-1M0-2V5" stroke="#aeb5b6" strokeWidth="4" /><circle cx="18" cy="-16" r="3" fill="#fff2bf" />
  </g>;
}

function Facade({ color, ornate = false }) {
  return <g>
    <path d="M0 20L12 5H70L82 20Z" fill={ornate ? "#c57546" : "#a88776"} />
    <rect x="3" y="20" width="76" height="200" fill={color} />
    <path d="M3 20H79M3 28H79M3 112H79M3 121H79" stroke="#fff3df" strokeWidth="5" />
    <path d="M8 30V112M74 30V112M8 124V210M74 124V210" stroke="#fff3df" strokeWidth="4" />
    <path d="M25 20Q41 -5 57 20" fill={color} stroke="#fff3df" strokeWidth="3" />
    <circle cx="41" cy="14" r="3" fill="#fff3df" />
    {[18, 47].map((x) => <g key={x}><path d={`M${x} 95V53Q${x + 9} 37 ${x + 18} 53V95Z`} fill={ornate ? "#217777" : "#759c91"} stroke="#fff3df" strokeWidth="3" />
      <path d={`M${x + 3} 60H${x + 15}M${x + 3} 68H${x + 15}M${x + 3} 76H${x + 15}M${x + 3} 84H${x + 15}`} stroke="#d8e1ca" strokeWidth="2" /></g>)}
    <path d="M19 210V150Q41 120 63 150V210Z" fill={ornate ? "#26797c" : "#90ada0"} stroke="#fff3df" strokeWidth="4" />
    <path d="M41 137V210" stroke="#fff3df" strokeWidth="2" />
    {[17, 33, 49, 65].map((x) => <g key={x}><path d={`M${x} 101l4 4-4 4-4-4Z`} fill={ornate ? "#eebf49" : "#fff3df"} />
      {ornate && <g><circle cx={x} cy="35" r="3" fill="#f6c54a" /><path d={`M${x - 3} 36q3 9 6 0`} fill="none" stroke="#fff3df" /></g>}</g>)}
    {ornate && <g>{Array.from({ length: 9 }, (_, i) => <path key={i} d={`M${7 + i * 8} 126l4 4-4 4-4-4Z`} fill="#eb709a" stroke="#fff3df" />)}<path d="M10 3L41-4L72 3" fill="none" stroke="#f8d471" strokeWidth="3" /></g>}
  </g>;
}

function Sign({ children, width = 70, color = "#396c64" }) {
  return <g><rect x="6" y="124" width={width} height="33" rx="3" fill={color} stroke="#fff3df" strokeWidth="1.5" />
    <text x={6 + width / 2} y="145" textAnchor="middle" fill="#fff8e9" fontFamily="sans-serif" fontWeight="bold" fontSize="10">{children}</text></g>;
}

function CoffeeQueue() {
  return <g aria-label="Single-file coffee queue facing the shop, everyone on their phone">
    {Array.from({ length: 18 }, (_, i) => {
      const skin = ["#f3d6bd", "#dfb96e", "#b57c59", "#704b38"][i % 4];
      return <g key={i} data-phone-user="true" data-skin-tone={skin} transform={`translate(${50 - i * 16} 207) scale(.78)`} strokeLinecap="round" strokeLinejoin="round">
        <path d="M-2-12L-3-1M1-12L2-1" stroke="#353943" strokeWidth="2.8" />
        <path d="M-3-1H0M2-1H5" stroke="#292731" strokeWidth="2" />
        <path d="M-1-23L0-12" stroke={["#356977", "#b9554d", "#b89445"][i % 3]} strokeWidth="6" />
        <g transform="rotate(14 0 -28)">
          <path d="M-3-33Q3-35 4-30L7-28L4-27V-24H-1L-3-28Z" fill={skin} />
          <path d="M-3-27Q-7-35 0-35Q5-35 4-31L-1-32V-27" fill="#302526" />
          <circle cx="3" cy="-30" r=".65" fill="#292731" />
        </g>
        <path d="M0-22L3-17L9-21" fill="none" stroke={skin} strokeWidth="2.3" />
        <g transform="rotate(12 10 -23)" aria-label="Phone">
          <rect x="7" y="-28" width="5" height="9" rx="1" fill="#252b35" />
          <rect x="8" y="-27" width="3" height="6" rx=".4" fill="#b7dfeb" />
        </g>
      </g>;
    })}
  </g>;
}

export const StreetBuilding = memo(function StreetBuilding({ item, crowd = 0, neon = 0, color = "#e5b99d", showQueue = true }) {
  const kind = item?.kind;
  if (kind === "motorbike") return <g aria-label="Motorbike Bar">
    <rect x="3" y="20" width="162" height="200" rx="3" fill="#27272b" stroke="#81817d" strokeWidth="2" />
    <path d="M0 20L18 5H151L168 20Z" fill="#17191c" /><path d="M12 45H156M12 58H156M12 112H156" stroke="#434449" strokeWidth="3" />
    <rect x="30" y="69" width="106" height="25" rx="12" fill="#bd6835" /><text x="83" y="86" textAnchor="middle" fill="#fff0d3" fontFamily="sans-serif" fontSize="10" fontWeight="bold">RIDE / REST / REPEAT</text>
    <rect x="13" y="157" width="142" height="55" fill="#151719" /><Sign width={152} color="#111216">MOTORBIKE BAR</Sign><Bike x={47} /><Bike x={117} />
  </g>;
  if (kind === "heritage") return <g aria-label="Colourful Peranakan houses with photographers">
    {["#ed639c", "#3eccc0", "#f3ba48"].map((paint, i) => <g key={paint} transform={`translate(${i * 86} 0)`}><Facade color={paint} ornate />
      <Person x={22} camera color="#3565a2" /><Person x={51} dress={i % 2 ? "#e55c42" : "#803c87"} /><Person x={72} camera color="#c1772f" scale={.9} /></g>)}
  </g>;
  return <g>
    <Facade color={kind === "viet" ? ["#f0b968", "#ecb2a0", "#8bcab2", "#e5cb76"][item.variant] : kind === "hq" ? "#f3c991" : color} />
    {kind === "dog" && <g><Sign><tspan x="41" dy="-8">Dog</tspan><tspan x="41" dy="12">Grooming</tspan></Sign><Paw /><FluffyDog variant={item.variant} /></g>}
    {kind === "night" && <g>
      <rect x="6" y="124" width="70" height="33" rx="3" fill="#231c29" stroke="#dc8eae" />
      <g className={`bun-neon bun-neon-${neon}`}><rect x="8" y="126" width="66" height="29" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <text x="41" y="147" fill="currentColor" textAnchor="middle" fontFamily="sans-serif" fontSize={item.variant === 2 ? 14 : 21} fontWeight="bold">{item.name.toUpperCase()}</text></g>
      <Person x={crowd === 0 ? 62 : 18} smoking />
      {crowd === 1 && <Person x={53} smoking color="#75414a" />}
      {crowd === 2 && <g><Person x={43} dress="#d73874" /><Person x={65} dress="#666bd6" /></g>}
    </g>}
    {kind === "viet" && <g><Sign color="#a34731">{item.name}</Sign>
      <path d="M9 158H73L78 168H4Z" fill="#3b8171" />
      {[9, 25, 41, 57].map((x) => <path key={x} d={`M${x} 158h8l3 10h-10Z`} fill="#fff1d1" />)}
      <circle cx="20" cy="40" r="6" fill="#b84239" /><path d="M20 33V24M20 46V51" stroke="#e8be57" />
      {item.variant === 0 ? <g transform="rotate(-18 41 187)"><rect x="22" y="180" width="38" height="12" rx="6" fill="#e4b66d" stroke="#8d623d" /><path d="M26 187H56" stroke="#478454" strokeWidth="3" /></g> : <g><path d="M27 181H55Q53 197 41 197Q29 197 27 181" fill="#fff2da" /><path d="M34 176q-5-5 0-10M44 176q-5-5 0-10" fill="none" stroke="#fff5e4" strokeWidth="2" /></g>}
    </g>}
    {kind === "coffee" && <g><Sign color="#4a332c">Viral Coffee</Sign><path d="M31 162H48V177Q31 184 31 171ZM48 164Q60 164 49 173" fill="#fff1d8" stroke="#795139" />
      {showQueue && <CoffeeQueue />}
    </g>}
    {kind === "hq" && <g><Sign color="#633e29"><tspan x="41" dy="-8">SWIRL GIRL</tspan><tspan x="41" dy="12">HQ</tspan></Sign>
      <path d="M5 159H77L80 171H2Z" fill="#ebbd84" /><image href="/logo.webp" x="21" y="166" width="43" height="43" preserveAspectRatio="xMidYMid meet" />
    </g>}
  </g>;
});

export default function BunStreet({ houses }) {
  return <g aria-label="Joo Chiat collectible street scenes">
    {houses.map(({ number, x, y, color, shop }) => <g key={number} data-house={number} data-scene={shop?.id || "house"} transform={`translate(${x} ${y})`} opacity={shop ? 1 : .65}>
      <StreetBuilding item={shop ? itemById(shop.id) : null} crowd={shop?.crowd} neon={shop?.neon} color={color} showQueue={false} />
    </g>)}
    {houses.filter((house) => house.shop?.id === "coffee").map(({ number, x, y }) => <g key={`queue-${number}`} transform={`translate(${x} ${y})`}><CoffeeQueue /></g>)}
  </g>;
}
