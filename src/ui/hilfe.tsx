// Erkennungshilfe: Heizkörperarten, Anschlüsse, Ventile und Voreinstellung als Skizzen. Funktioniert offline.
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';

let hilfeSetzen: ((offen: boolean) => void) | null = null;

export function HilfeKnopf() {
  return (
    <button class="kopf-knopf plan-knopf" onClick={() => hilfeSetzen?.(true)}>
      Hilfe
    </button>
  );
}

function Bild(props: { children: ComponentChildren; breit?: boolean }) {
  return (
    <svg class="hilfe-bild" viewBox={props.breit ? '0 0 240 120' : '0 0 160 120'} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      {props.children}
    </svg>
  );
}

function Karte(props: { titel: string; bild: ComponentChildren; children: ComponentChildren }) {
  return (
    <div class="hilfe-karte">
      {props.bild}
      <div>
        <div class="hilfe-titel">{props.titel}</div>
        <div class="hilfe-text">{props.children}</div>
      </div>
    </div>
  );
}

const linien = (n: number, f: (i: number) => ComponentChildren) => Array.from({ length: n }, (_, i) => f(i));

/** Heizkörper von vorn mit Rohren. vl/rl: Position der Rohre, kopf: Position des Thermostatkopfs. */
function Anschluss(props: { art: 'gleich' | 'wechsel' | 'mittig' | 'seitlich' }) {
  const a = props.art;
  return (
    <Bild>
      <rect x="35" y="25" width="90" height="60" rx="3" />
      {a === 'gleich' && (
        <>
          <path d="M35 35 H18 V112" class="vl" />
          <path d="M35 77 H26 V112" class="rl" />
          <rect x="20" y="29" width="12" height="12" rx="2" class="kopf" />
        </>
      )}
      {a === 'wechsel' && (
        <>
          <path d="M35 35 H18 V112" class="vl" />
          <path d="M125 77 H142 V112" class="rl" />
          <rect x="20" y="29" width="12" height="12" rx="2" class="kopf" />
        </>
      )}
      {a === 'mittig' && (
        <>
          <path d="M75 85 V112" class="vl" />
          <path d="M85 85 V112" class="rl" />
          <rect x="125" y="29" width="12" height="12" rx="2" class="kopf" />
        </>
      )}
      {a === 'seitlich' && (
        <>
          <path d="M108 85 V112" class="vl" />
          <path d="M118 85 V112" class="rl" />
          <rect x="125" y="29" width="12" height="12" rx="2" class="kopf" />
        </>
      )}
      <path d="M8 112 H152" stroke-dasharray="3 5" stroke-width="1" />
    </Bild>
  );
}

export function HilfeViewer() {
  const [offen, setOffen] = useState(false);
  hilfeSetzen = setOffen;
  if (!offen) return null;
  return (
    <div class="viewer plan-viewer">
      <div class="viewer-leiste">
        <span class="viewer-name plan-titel">Hilfe · Heizkörper erkennen</span>
        <button class="knopf" onClick={() => setOffen(false)}>
          Schließen
        </button>
      </div>
      <div class="hilfe">
        <h2>Heizkörperart</h2>
        <Karte
          titel="Plattenheizkörper"
          bild={
            <Bild>
              <rect x="20" y="25" width="120" height="65" rx="3" />
              {linien(11, (i) => (
                <path key={i} d={`M${30 + i * 10} 31 V84`} stroke-width="1" />
              ))}
            </Bild>
          }
        >
          Glatte oder fein gerippte Blechplatte als geschlossene Front, oben ein Abdeckgitter. Der häufigste Heizkörper. Den Typ sieht man
          von oben oder von der Seite, siehe „Typ“.
        </Karte>
        <Karte
          titel="Typ beim Plattenheizkörper (10, 11, 21, 22, 33)"
          bild={
            <Bild>
              <text x="6" y="24" class="hilfe-zahl">11</text>
              <path d="M40 16 H150" />
              <path d="M40 24 l6 6 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6" stroke-width="1" />
              <text x="6" y="62" class="hilfe-zahl">22</text>
              <path d="M40 48 H150 M40 76 H150" />
              <path d="M40 54 l6 6 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6" stroke-width="1" />
              <path d="M40 64 l6 6 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6 l6 -6 l6 6" stroke-width="1" />
              <text x="6" y="106" class="hilfe-zahl">Blick von oben</text>
            </Bild>
          }
        >
          Von oben durch das Gitter schauen. Erste Ziffer = Zahl der Platten (gerade Linien), zweite Ziffer = Zahl der gewellten
          Lamellenbleche dazwischen. 10 = eine Platte ohne Blech, 11 = eine Platte mit einem Blech, 21 = zwei Platten mit einem Blech,
          22 = zwei Platten mit zwei Blechen, 33 = drei Platten mit drei Blechen. Anhalt Bautiefe: 11 etwa 60 mm, 22 etwa 100 mm, 33 etwa
          155 mm.
        </Karte>
        <Karte
          titel="Gliederheizkörper"
          bild={
            <Bild>
              {linien(8, (i) => (
                <rect key={i} x={22 + i * 15} y="22" width="11" height="70" rx="5" />
              ))}
            </Bild>
          }
        >
          Alter Rippenheizkörper aus Guss oder Stahl. Einzelne breite Glieder stehen nebeneinander, dazwischen kann man durchschauen. Jedes
          Glied ist etwa 45 bis 60 mm breit. Glieder zählen und als Gliederzahl eintragen.
        </Karte>
        <Karte
          titel="Röhrenradiator"
          bild={
            <Bild>
              <path d="M20 26 H140 M20 90 H140" stroke-width="4" />
              {linien(15, (i) => (
                <path key={i} d={`M${24 + i * 8} 28 V88`} stroke-width="3" />
              ))}
            </Bild>
          }
        >
          Viele dünne runde Rohre senkrecht nebeneinander, oben und unten in einem Sammelstück verbunden. Wirkt feiner als der
          Gliederheizkörper. Von der Seite sieht man, wie viele Rohre hintereinander stehen (2 bis 6) – das bestimmt die Bautiefe. Elemente
          von vorn zählen und als Gliederzahl eintragen.
        </Karte>
        <Karte
          titel="Badheizkörper"
          bild={
            <Bild>
              <path d="M55 12 V108 M105 12 V108" stroke-width="4" />
              {linien(9, (i) => (
                <path key={i} d={`M55 ${20 + i * 10 + (i > 3 ? 6 : 0) + (i > 6 ? 6 : 0)} H105`} />
              ))}
            </Bild>
          }
        >
          Hoch und schmal wie eine Leiter: zwei senkrechte Rohre, dazwischen waagerechte Rohre als Handtuchhalter.
        </Karte>
        <Karte
          titel="Konvektor / Unterflur"
          bild={
            <Bild>
              <rect x="15" y="14" width="130" height="34" rx="3" />
              {linien(20, (i) => (
                <path key={i} d={`M${22 + i * 6} 20 V42`} stroke-width="1" />
              ))}
              <path d="M8 78 H40 V104 H120 V78 H152" />
              <path d="M40 78 H120" stroke-width="4" stroke-dasharray="2 4" />
              <path d="M52 94 H108" stroke-width="3" />
            </Bild>
          }
        >
          Konvektor (oben): niedriger, langer Kasten, innen ein Rohr mit vielen dünnen Blechlamellen, keine glatte Heizplatte.
          Unterflurkonvektor (unten): dasselbe im Boden versenkt, man sieht nur ein Gitter im Fußboden, meist vor bodentiefen Fenstern.
        </Karte>
        <Karte
          titel="Fußbodenheizung"
          bild={
            <Bild>
              <path d="M20 20 H140 V40 H20 V60 H140 V80 H20 V100 H140" />
            </Bild>
          }
        >
          Kein Heizkörper im Raum. Erkennbar am Raumregler an der Wand und am Verteilerschrank (meist im Flur oder Abstellraum).
        </Karte>

        <h2>Anschluss</h2>
        <div class="hilfe-legende">
          <span class="vl-text">rot = Vorlauf</span> · <span class="rl-text">blau = Rücklauf</span> · grünes Kästchen = Thermostatkopf
        </div>
        <Karte titel="seitlich gleich" bild={<Anschluss art="gleich" />}>
          Beide Rohre gehen an derselben Seite in den Heizkörper: oben der Vorlauf mit dem Thermostatventil, darunter der Rücklauf.
        </Karte>
        <Karte titel="seitlich wechsel" bild={<Anschluss art="wechsel" />}>
          Vorlauf oben auf der einen Seite, Rücklauf unten auf der anderen Seite. Oft bei langen Heizkörpern.
        </Karte>
        <Karte titel="unten mittig (VK)" bild={<Anschluss art="mittig" />}>
          Ventilheizkörper (VK): Zwei Rohre kommen dicht nebeneinander (5 cm Abstand) von unten in die Mitte. Kein Rohr geht seitlich oben
          hinein; der Thermostatkopf sitzt oben seitlich direkt am Heizkörper.
        </Karte>
        <Karte titel="unten seitlich (VK)" bild={<Anschluss art="seitlich" />}>
          Ventilheizkörper (VK): Zwei Rohre dicht nebeneinander von unten an der rechten oder linken Ecke. Der Thermostatkopf sitzt oben auf
          derselben Seite direkt am Heizkörper.
        </Karte>

        <h2>Ventil und Voreinstellung</h2>
        <Karte
          titel="Ventil erkennen"
          bild={
            <Bild>
              <path d="M10 60 H50 M110 60 H150" stroke-width="5" />
              <rect x="50" y="46" width="60" height="28" rx="4" />
              <rect x="68" y="26" width="24" height="20" />
              <path d="M72 30 H88 M72 36 H88 M72 42 H88" stroke-width="1" class="kopf" />
              <rect x="74" y="12" width="12" height="14" class="kopf" />
              <path d="M112 36 L96 36" stroke-width="1" />
              <text x="114" y="30" class="hilfe-zahl">Ring</text>
              <text x="114" y="44" class="hilfe-zahl">1 … 8</text>
            </Bild>
          }
        >
          Der Thermostatkopf ist nur der Drehgriff. Das Ventil sitzt darunter. Kopf auf die höchste Stufe drehen, dann die Rändelmutter am
          Kopf von Hand lösen (bei Danfoss oft ein Klemmring oder Klick) und den Kopf abziehen. Es tritt kein Wasser aus. Der Hersteller
          steht auf dem Kopf und als Prägung auf dem Ventilkörper (z. B. Heimeier, Danfoss, Oventrop, Honeywell/MNG).
        </Karte>
        <Karte
          titel="Voreinstellung ablesen"
          bild={
            <Bild>
              <circle cx="80" cy="60" r="44" />
              <circle cx="80" cy="60" r="26" />
              <circle cx="80" cy="60" r="6" />
              <text x="75" y="30" class="hilfe-zahl">4</text>
              <text x="107" y="50" class="hilfe-zahl">5</text>
              <text x="46" y="50" class="hilfe-zahl">3</text>
              <text x="105" y="84" class="hilfe-zahl">6</text>
              <text x="47" y="84" class="hilfe-zahl">2</text>
              <path d="M80 4 V14" stroke-width="4" class="kopf" />
            </Bild>
          }
        >
          Nach dem Abnehmen des Kopfes sieht man von vorn auf das Ventil. Hat es eine Voreinstellung, sitzt um den Stift ein Ring mit Zahlen
          (je nach Hersteller 1 bis 6, 1 bis 7 und N, 1 bis 8 oder 1 bis 9). Die Zahl, die an der Markierung (Kerbe, Strich oder Punkt am
          Ventil) steht, ist die Voreinstellung. „N“ heißt voll offen. Gibt es keinen Ring mit Zahlen, hat das Ventil keine Voreinstellung:
          dann bei „Voreinstellung ablesbar“ nein wählen.
        </Karte>
        <div class="hilfe-text hilfe-schluss">
          Bei Ventilheizkörpern (VK) sitzt das Ventil als Einsatz oben im Heizkörper unter dem Thermostatkopf; der Zahlenring ist dort
          genauso zu sehen. Im Zweifel nichts raten: Foto „Ventil“ formatfüllend machen, die Auswertung klärt es später.
        </div>
      </div>
    </div>
  );
}
