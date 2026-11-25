// Build: node build.mjs      (groom's side: Vedant & Vrishali)
// Source of truth is src/template.html (English). One build writes two sites into dist/:
//   WEDDING + RECEPTION   dist/en/  dist/ma/  dist/index.html            (https://<site>/)
//   RECEPTION ONLY        dist/rec/en/  dist/rec/ma/  dist/rec/index.html   (https://<site>/rec/)
//   dist/404.html, dist/_headers, dist/assets/...
// Marathi text is applied by exact replacement pairs (MR). The reception-only pages come from the same template: blocks marked
// <!--@w-->...<!--@/w--> are removed and the REC pairs swap the date, time, venue and wording. Every pair must match,
// otherwise the build stops with an error.
//
// Cloudflare Pages settings: Build command `node build.mjs`, Build output directory `dist`.
// Link previews need absolute URLs. Set SITE_URL if the address is not the default (e.g. a custom domain).
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync, existsSync } from "node:fs";

const SITE = (process.env.SITE_URL || "https://vedantwedsvrishali.pages.dev").replace(/\/+$/, "");
const OUT = new URL("./dist/", import.meta.url);
const ALBUM = false;   // the groom's-side sites have no photo album (set true, restore src/gallery.json + assets/photos to bring it back)
const T0 = readFileSync(new URL("./src/template.html", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const S = '<svg class="swas" aria-hidden="true"><use href="#swastika"/></svg>';

// Assets live in the site root; pages live one or two folders down.
const fixPaths = (h, up) =>
  h.replace(/(src|href)="(photo\d\.jpg|assets\/)/g, (m, a, b) => `${a}="${up}${b}`)
   .replace(/url\((assets\/)/g, (m, a) => `url(${up}${a}`)
   .replace(/'(photo\d\.jpg)'/g, (m, a) => `'${up}${a}'`)
   .replace(/'(assets\/)/g, (m, a) => `'${up}${a}`);

/* ---------- MARATHI TEXT ----------
   From the printed Marathi cards: bride's side card (wedding wording, parents) and the reception card (स्वागत समारंभ व प्रितीभोज).
   Card front:  ॥शुभविवाह॥ · चि. वेदांत · चि.सौ.कां. वृषाली · शुक्रवार दि. ०१ जानेवारी २०२७ रोजी · सकाळी १० वा. ३० मि. · सस्नेह निमंत्रण
   Inside:      स.न.वि.वि. आमचे येथे श्रीकृपेकरुन · चि. वेदांत: सौ. प्रिया व प्रा.डॉ.श्री. संजयराव तिरथकर, रा. अमरावती यांचे चिरंजीव
                चि.सौ.कां. वृषाली: सौ. अर्चना व श्री. सुभाषराव गुल्हाने, रा. सुरळी, जि. अमरावती, ह.मु. पुणे यांची कन्या
                * विवाह मुहूर्त * मिती मार्गशीर्ष कृ.९ शके १९४८ / शुक्रवार दि. १जानेवारी २०२७ / सकाळी १०.३० वा.
                * विवाहस्थळ * सिल्वर स्टार / सेलीब्रेशन हॉल / शेगाव-रहाटगांव रोड / अमरावती
   Reception:   ।। स्वागत समारंभ व प्रितीभोज ।। शनिवार, दि. ०२ जानेवारी २०२७ · वेळ : सायंकाळी ०७ ते रात्री ११ वा. पर्यंत
                स्थळ - लोटस इन बटरफ्लाय लॉन, रहाटगांव रिंग रोड, अमरावती · विनीत: प्रा.डॉ. संजय श्रीधरराव तिरथकर, सौ. प्रिया संजयराव तिरथकर
   Grandparent lines are left out on purpose (parents only).
   Not on any card, written by us (to be checked): the groom-side regards in Marathi, button/heading words, the English wording of the reception.
------------------------------------------------------------------------ */
const WA_MR = "नमस्कार, मी वेदांत व वृषाली यांच्या शुभविवाहाला उपस्थित राहीन.";
const MR = [
  // document
  ['<html lang="en">', '<html lang="mr">'],
  ['<title>Vedant &amp; Vrishali · Wedding Invitation</title>', '<title>वेदांत 卐 वृषाली · शुभविवाह</title>'],
  ['content="Wedding Invitation · Vedant with Vrishali · Friday, 1 January 2027, 10:30 AM · Silver Star Celebration Hall, Shegaon-Rahatgaon Road, Amravati"', 'content="शुभविवाह · चि. वेदांत व चि.सौ.कां. वृषाली · शुक्रवार दि. ०१ जानेवारी २०२७ रोजी सकाळी १० वा. ३० मि. · सिल्वर स्टार सेलीब्रेशन हॉल, शेगाव-रहाटगांव रोड, अमरावती"'],
  ['<meta property="og:title" content="Vedant &amp; Vrishali · Wedding Invitation">', '<meta property="og:title" content="वेदांत 卐 वृषाली · शुभविवाह">'],
  ['<meta property="og:description" content="Friday, 1 January 2027 · 10:30 AM · Silver Star Celebration Hall, Shegaon-Rahatgaon Road, Amravati">', '<meta property="og:description" content="शुक्रवार दि. ०१ जानेवारी २०२७ रोजी सकाळी १० वा. ३० मि. · सिल्वर स्टार सेलीब्रेशन हॉल, शेगाव-रहाटगांव रोड, अमरावती">'],

  // 5.1 gate
  ['aria-label="Wedding invitation of Vedant and Vrishali. Press Tap to Open."', 'aria-label="वेदांत व वृषाली यांचे शुभविवाह निमंत्रण. उघडण्यासाठी टॅप करा."'],
  [`<div class="plaque-text"><span class="en">Vedant${S}Vrishali</span></div>`, `<div class="plaque-text"><span class="mr">वेदांत${S}वृषाली</span></div>`],
  ['Opening the invitation…', 'निमंत्रण उघडत आहे…'],
  ['<button class="btn" id="openBtn" type="button">Tap to Open</button>', '<button class="btn" id="openBtn" type="button">उघडण्यासाठी टॅप करा</button>'],

  // 5.2 hero
  ['aria-label="Vedant with Vrishali">', 'aria-label="वेदांत व वृषाली">'],
  ['<p class="bless" data-h style="--d:.2s">II Shree Ganeshaya Namah II</p>', '<p class="bless" data-h style="--d:.2s">।। श्री गणेशाय नमः ।।</p>'],
  ['<p class="bless-mr" data-h style="--d:.35s">।। श्री गणेशाय नमः ।।</p>', '<p class="bless-mr" data-h style="--d:.35s">स.न.वि.वि. आमचे येथे श्रीकृपेकरुन</p>'],
  ['<h1 class="names" aria-label="Vedant with Vrishali">', '<h1 class="names" aria-label="चि. वेदांत व चि.सौ.कां. वृषाली">'],
  ['<span class="nm n1" aria-hidden="true">Vedant</span>', '<span class="nm n1" aria-hidden="true">वेदांत</span>'],
  ['<span class="nm with" aria-hidden="true">with</span>', `<span class="nm with" aria-hidden="true">${S}</span>`],
  ['<span class="nm n2" aria-hidden="true">Vrishali</span>', '<span class="nm n2" aria-hidden="true">वृषाली</span>'],
  [/(<p class="names-mr"[^>]*>)वेदांत\s+वृषाली(<\/p>)/, (m, a, b) => `${a}सस्नेह निमंत्रण${b}`],
  ['<p class="hero-sub" data-h style="--d:2.3s">Wedding Invitation</p>', '<p class="hero-sub" data-h style="--d:2.3s">॥ शुभविवाह ॥</p>'],
  ['<p class="hero-date" data-h style="--d:2.5s"><span>Friday</span><i aria-hidden="true"></i><span>1 January 2027</span><i aria-hidden="true"></i><span>10:30 AM</span></p>', '<p class="hero-date" data-h style="--d:2.5s"><span>शुक्रवार दि. ०१ जानेवारी २०२७ रोजी</span><i aria-hidden="true"></i><span>सकाळी १० वा. ३० मि.</span></p>'],
  ['<svg aria-hidden="true"><use href="#i-cal"/></svg>Save the Date</a>', '<svg aria-hidden="true"><use href="#i-cal"/></svg>दिनांक लक्षात ठेवा</a>'],
  ['aria-label="Scroll to the invitation card"', 'aria-label="निमंत्रण पत्रिकेकडे जा"'],
  ['alt="Vedant and Vrishali walking down the aisle, smiling at each other while soft white balls fall around them"', 'alt="वेदांत व वृषाली हसत एकमेकांकडे पाहत चालताना, भोवती पांढरे गोळे पडत आहेत"'],

  // 5.3 invitation card
  ['<p class="eyebrow" data-reveal="fade">The Invitation</p>', '<p class="eyebrow" data-reveal="fade">निमंत्रण पत्रिका</p>'],
  ['<span>Wedding Ceremony</span></span></h2>', '<span>॥&nbsp;यांचा शुभविवाह&nbsp;॥</span></span></h2>'],
  ['<p class="sub" data-reveal="up" style="--d:.3s">Friday · 1 January 2027</p>', '<p class="sub" data-reveal="up" style="--d:.3s">शुक्रवार दि. ०१ जानेवारी २०२७ रोजी</p>', 'all'],
  ['<span class="arch-names">Vedant<br>Vrishali</span>', '<span class="arch-names">वेदांत<br>वृषाली</span>'],
  ['<p class="c-bless">II Shree Ganeshaya Namah II</p>', '<p class="c-bless">।। श्री गणेशाय नमः ।।</p>'],
  ['<p class="c-req">WE REQUEST YOUR GRACIOUS PRESENCE FOR THE WEDDING CEREMONY OF</p>', '<p class="c-req">स.न.वि.वि. आमचे येथे श्रीकृपेकरुन</p>'],
  ['<p class="c-name">Vedant</p>', '<p class="c-name">चि. वेदांत</p>'],
  ['<p class="c-par">(S/o Mrs. Priya &amp; Prof. Dr. Sanjay Tirathkar)</p>', '<p class="c-par">सौ. प्रिया व प्रा.डॉ.श्री. संजयराव तिरथकर<br>रा. अमरावती यांचे चिरंजीव</p>'],
  ['<p class="c-with">with</p>', `<p class="c-with">${S}</p>`],
  ['<p class="c-name">Vrishali</p>', '<p class="c-name">चि.सौ.कां. वृषाली</p>'],
  ['<p class="c-par">(D/o. Mrs. Archana &amp; Mr. Subhash Gulhane)</p>', '<p class="c-par">सौ. अर्चना व श्री. सुभाषराव गुल्हाने<br>रा. सुरळी, जि. अमरावती, ह.मु. पुणे यांची कन्या</p>'],
  ['<p class="c-bo">BLESSINGS ONLY</p>', '<p class="c-bo">।। यांचा शुभविवाह ।।</p>'],
  ['<p class="b-title">Wedding Ceremony</p>', '<p class="b-title">विवाह मुहूर्त</p>'],
  ['<span class="b-side">Friday</span>', '<span class="b-side">शुक्रवार</span>'],
  ['<span class="b-main"><span>January</span><b>01</b><span>2027</span></span>', '<span class="b-main"><span>जानेवारी</span><b>१</b><span>२०२७</span></span>'],
  ['<span class="b-side">10:30 AM</span>', '<span class="b-side">सकाळी १०.३० वा.</span>'],
  ['<p class="b-vl">Venue</p>', '<p class="b-vl">विवाहस्थळ</p>'],
  ['<p class="b-venue">Silver Star Celebration Hall</p>', '<p class="b-venue">सिल्वर स्टार सेलीब्रेशन हॉल</p>'],
  ['<p class="b-addr">Shegaon-Rahatgaon Road, Amravati</p>', '<p class="b-addr">शेगाव-रहाटगांव रोड<br>अमरावती</p>'],
  ['<p class="b-rl">With Regards:</p>', '<p class="b-rl">मिती मार्गशीर्ष कृ.९ शके १९४८</p>'],
  ['<p class="b-reg">Sau. Priya &amp; Prof. Dr. Sanjay Tirathkar</p>', '<p class="b-reg">स्वरुची भोज लग्नानंतर लगेच</p>'],
  ['<p class="b-reg2">Inside Ambagate, Amravati</p>', '<p class="b-reg2">सस्नेह निमंत्रण</p>'],
  ['<span id="turnTxt">Tap to turn</span>', '<span id="turnTxt">पत्रिका उलटा</span>'],

  // 5.4 couple
  ['<p class="eyebrow" data-reveal="fade">The Couple</p>', '<p class="eyebrow" data-reveal="fade">वर-वधू</p>'],
  ['<span>Bride &amp; Groom</span></span></h2>', '<span>वर व वधू</span></span></h2>'],
  ['<p class="sub" data-reveal="up" style="--d:.3s">Vedant with Vrishali</p>', `<p class="sub" data-reveal="up" style="--d:.3s">वेदांत${S}वृषाली</p>`],
  ['alt="Illustrated portrait of Vrishali"', 'alt="वृषालीचे चित्र"'],
  ['alt="Illustrated portrait of Vedant"', 'alt="वेदांतचे चित्र"'],
  ['<p class="eyebrow p-label">Bride</p>', '<p class="eyebrow p-label">वधू</p>'],
  ['<h3 class="p-name">Vrishali</h3>', '<h3 class="p-name">वृषाली</h3>'],
  ['<p class="p-par">D/o. Mrs. Archana &amp; Mr. Subhash Gulhane</p>', '<p class="p-par">सौ. अर्चना व श्री. सुभाषराव गुल्हाने<br>रा. सुरळी, जि. अमरावती, ह.मु. पुणे यांची कन्या</p>'],
  ['<p class="eyebrow p-label">Groom</p>', '<p class="eyebrow p-label">वर</p>'],
  ['<h3 class="p-name">Vedant</h3>', '<h3 class="p-name">वेदांत</h3>'],
  ['<p class="p-par">S/o Mrs. Priya &amp; Prof. Dr. Sanjay Tirathkar</p>', '<p class="p-par">सौ. प्रिया व प्रा.डॉ.श्री. संजयराव तिरथकर<br>रा. अमरावती यांचे चिरंजीव</p>'],

  // marquee
  ["html += '<span class=\"mq-item\">Shubh Vivah<img", "html += '<span class=\"mq-item\">शुभविवाह<img"],

  // 5.5 countdown
  ['<p class="eyebrow" data-reveal="fade">Save the Date</p>', '<p class="eyebrow" data-reveal="fade">विवाह मुहूर्त</p>'],
  ['<span>Counting Down</span></span></h2>', '<span>उलटी गणती</span></span></h2>'],
  ['<span class="cd-lab">Days</span>', '<span class="cd-lab">दिवस</span>'],
  ['<span class="cd-lab">Hours</span>', '<span class="cd-lab">तास</span>'],
  ['<span class="cd-lab">Minutes</span>', '<span class="cd-lab">मिनिटे</span>'],
  ['<span class="cd-lab">Seconds</span>', '<span class="cd-lab">सेकंद</span>'],
  ['<p class="cd-done" id="cdDone" hidden>Just Married</p>', '<p class="cd-done" id="cdDone" hidden>शुभविवाह संपन्न</p>'],
  ['<p class="cd-sub" data-reveal="up" style="--d:.4s">1 January 2027 · 10:30 AM IST</p>', '<p class="cd-sub" data-reveal="up" style="--d:.4s">शुक्रवार दि. १जानेवारी २०२७ · सकाळी १०.३० वा.</p>'],

  // 5.6 venue
  ['<p class="eyebrow" data-reveal="fade">Where to Find Us</p>', '<p class="eyebrow" data-reveal="fade">पत्ता</p>'],
  ['<span>Venue Details</span></span></h2>', '<span>विवाहस्थळ</span></span></h2>'],
  ['<p class="sub" data-reveal="up" style="--d:.3s">Silver Star Celebration Hall</p>', '<p class="sub" data-reveal="up" style="--d:.3s">सिल्वर स्टार सेलीब्रेशन हॉल</p>'],
  ['<p class="v-lab">Date</p><p class="v-val">1 January 2027</p><p class="v-small">Friday</p>', '<p class="v-lab">दिनांक</p><p class="v-val">१जानेवारी २०२७</p><p class="v-small">शुक्रवार</p>'],
  ['<p class="v-lab">Time</p><p class="v-val">10:30 AM</p><p class="v-small">IST</p>', '<p class="v-lab">वेळ</p><p class="v-val">सकाळी १०.३० वा.</p><p class="v-small">भारतीय वेळ</p>'],
  ['<p class="v-lab">Venue</p><p class="v-val">Silver Star Celebration Hall</p><p class="v-small">Shegaon-Rahatgaon Road, Amravati</p>', '<p class="v-lab">विवाहस्थळ</p><p class="v-val">सिल्वर स्टार सेलीब्रेशन हॉल</p><p class="v-small">शेगाव-रहाटगांव रोड, अमरावती</p>'],
  ['<svg aria-hidden="true"><use href="#i-cal"/></svg>Add to Calendar</button>', '<svg aria-hidden="true"><use href="#i-cal"/></svg>कॅलेंडरमध्ये जोडा</button>'],
  ['<svg aria-hidden="true"><use href="#i-pin"/></svg>Get Directions</a>', '<svg aria-hidden="true"><use href="#i-pin"/></svg>मार्ग पहा</a>'],
  ['<h4>Wedding Muhurat</h4><p>Margashirsha Krishna 9, Shaka 1948<br>Friday, 1 January 2027<br>10:30 AM</p>', '<h4>* विवाह मुहूर्त *</h4><p class="dev" lang="mr">मिती मार्गशीर्ष कृ.९ शके १९४८<br>शुक्रवार दि. १जानेवारी २०२७<br>सकाळी १०.३० वा.</p>'],
  ['<h4>Wedding Venue</h4><p>Silver Star<br>Celebration Hall<br>Shegaon-Rahatgaon Road<br>Amravati</p>', '<h4>* विवाहस्थळ *</h4><p class="dev" lang="mr">सिल्वर स्टार<br>सेलीब्रेशन हॉल<br>शेगाव-रहाटगांव रोड<br>अमरावती</p>'],
  ['&amp;hl=en&amp;output=embed" title="Google Maps: Silver Star Celebration Hall, Shegaon-Rahatgaon Road, Amravati"', '&amp;hl=mr&amp;output=embed" title="Google नकाशा: सिल्वर स्टार सेलीब्रेशन हॉल, शेगाव-रहाटगांव रोड, अमरावती"'],
  ['<span class="map-label">Silver Star Celebration Hall</span><span class="map-addr">Shegaon-Rahatgaon Road, Amravati</span>', '<span class="map-label">सिल्वर स्टार सेलीब्रेशन हॉल</span><span class="map-addr">शेगाव-रहाटगांव रोड, अमरावती</span>'],
  ['<svg aria-hidden="true"><use href="#i-pin"/></svg>Open in Google Maps</a>', '<svg aria-hidden="true"><use href="#i-pin"/></svg>Google Maps मध्ये उघडा</a>'],

  // 5.7 events (wedding + reception)
  ['<p class="eyebrow" data-reveal="fade">Programme</p>', '<p class="eyebrow" data-reveal="fade">कार्यक्रम</p>'],
  ['<span>Wedding &amp; Reception</span></span></h2>', '<span>विवाह व स्वागत समारंभ</span></span></h2>'],
  ['<p class="sub" data-reveal="up" style="--d:.3s">1 – 2 January 2027</p>', '<p class="sub" data-reveal="up" style="--d:.3s">१ ते २ जानेवारी २०२७</p>'],
  ['<h3 class="tl-fn" style="margin:0;font-weight:400">Wedding</h3>', '<h3 class="tl-fn" style="margin:0;font-weight:400">शुभविवाह</h3>'],
  ['<p class="tl-meta"><span>1 January 2027</span><i aria-hidden="true"></i><span>Friday</span><i aria-hidden="true"></i><span>10:30 AM</span></p>', '<p class="tl-meta"><span>शुक्रवार दि. १जानेवारी २०२७</span><i aria-hidden="true"></i><span>सकाळी १०.३० वा.</span></p>'],
  ['<p class="tl-venue">Silver Star Celebration Hall<br>Shegaon-Rahatgaon Road, Amravati</p>', '<p class="tl-venue">सिल्वर स्टार सेलीब्रेशन हॉल<br>शेगाव-रहाटगांव रोड, अमरावती</p>'],
  ['<h3 class="tl-fn" style="margin:0;font-weight:400">Welcome Reception &amp; Dinner</h3>', '<h3 class="tl-fn" style="margin:0;font-weight:400">स्वागत समारंभ व प्रितीभोज</h3>'],
  ['<p class="tl-meta"><span>2 January 2027</span><i aria-hidden="true"></i><span>Saturday</span><i aria-hidden="true"></i><span>7:00 PM to 11:00 PM</span></p>', '<p class="tl-meta"><span>शनिवार, दि. ०२ जानेवारी २०२७</span><i aria-hidden="true"></i><span>सायंकाळी ०७ ते रात्री ११ वा. पर्यंत</span></p>'],
  ['<p class="tl-venue">Lotus Inn Butterfly Lawn<br>Rahatgaon Ring Road, Amravati</p>', '<p class="tl-venue">लोटस इन बटरफ्लाय लॉन<br>रहाटगांव रिंग रोड, अमरावती</p>'],
  ['<svg aria-hidden="true"><use href="#i-pin"/></svg>Directions</a>', '<svg aria-hidden="true"><use href="#i-pin"/></svg>मार्ग पहा</a>', 'all'],

  // 5.16 saptapadi
  ['<p class="eyebrow" data-reveal="fade">Seven Steps</p>', '<p class="eyebrow" data-reveal="fade">सात पावले</p>'],
  ['<h2 class="sapta-title" id="spTitle" data-reveal="scale">Saptapadi</h2>', '<h2 class="sapta-title" id="spTitle" data-reveal="scale">सप्तपदी</h2>'],
  ['aria-label="Seven pairs of gold footprints along a curve, numbered 1 to 7, ending at a kalash with a lit diya"', 'aria-label="सात सोनेरी पावलांच्या जोड्या, १ ते ७ क्रमांक, शेवटी कलश व दिवा"'],

  // designer's credit and music button
  ['aria-label="Website credit"', 'aria-label="वेबसाइट निर्मिती"'],
  ['<p class="cr-by">Website crafted by <b>Rvic Edits</b></p>', '<p class="cr-by">वेबसाइट निर्मिती : <b>Rvic Edits</b></p>'],
  ['<p class="cr-txt">Planning a celebration of your own? We design elegant, animated invitation websites just like this one. Message us on WhatsApp to get yours.</p>', '<p class="cr-txt">तुमच्या खास कार्यक्रमासाठी असेच सुंदर, ॲनिमेटेड निमंत्रण संकेतस्थळ हवे आहे? आम्हाला व्हॉट्सॲपवर संदेश पाठवा.</p>'],
  ['</svg>Message Rvic Edits on WhatsApp</a>', '</svg>Rvic Edits ला WhatsApp वर संदेश पाठवा</a>'],
  ['<span class="tip" aria-hidden="true">Tap for music</span>', '<span class="tip" aria-hidden="true">संगीतासाठी टॅप करा</span>'],
  ['data-label-on="Mute music" data-label-off="Play music" aria-label="Play music"', 'data-label-on="संगीत बंद करा" data-label-off="संगीत सुरू करा" aria-label="संगीत सुरू करा"'],

  // 5.17 families (groom's first)
  ['<p class="eyebrow" data-reveal="fade">Families</p>', '<p class="eyebrow" data-reveal="fade">कुटुंबीय</p>'],
  ['<span>With Blessings From</span></span></h2>', '<span>शुभाशीर्वाद</span></span></h2>'],
  ["<h3>Bride's Family</h3><p>Mrs. Archana &amp; Mr. Subhash Gulhane</p>", '<h3>वधूचे आई-वडील</h3><p>सौ. अर्चना व श्री. सुभाषराव गुल्हाने</p>'],
  ["<h3>Groom's Family</h3><p>Mrs. Priya &amp; Prof. Dr. Sanjay Tirathkar</p>", '<h3>वराचे आई-वडील</h3><p>सौ. प्रिया व प्रा.डॉ.श्री. संजयराव तिरथकर</p>'],

  // 5.9 footer
  ['alt="Illustration of Vedant and Vrishali holding hands"', 'alt="हात धरलेले वेदांत व वृषाली यांचे चित्र"'],
  ['<p class="f-bo" data-reveal="fade">Blessings Only</p>', '<p class="f-bo" data-reveal="fade">आहेर पध्दत पुर्णतः बंद....आपली उपस्थिती व आशिर्वादच अमुल्य....</p>'],
  ['<span>Vedant <span class="amp">&amp;</span> Vrishali</span>', `<span>वेदांत <span class="amp">${S}</span> वृषाली</span>`],
  ['<p class="f-date" data-reveal="up">Friday · 1 January 2027 · 10:30 AM</p>', '<p class="f-date" data-reveal="up">शुक्रवार दि. ०१ जानेवारी २०२७ रोजी · सकाळी १० वा. ३० मि.</p>'],
  ['<p class="f-venue" data-reveal="up" style="--d:.1s">Silver Star Celebration Hall<br>Shegaon-Rahatgaon Road, Amravati</p>', '<p class="f-venue" data-reveal="up" style="--d:.1s">सिल्वर स्टार सेलीब्रेशन हॉल<br>शेगाव-रहाटगांव रोड, अमरावती</p>'],
  ['<p class="f-date" data-reveal="up" style="--d:.15s">Reception · Saturday · 2 January 2027 · 7:00 PM to 11:00 PM</p>', '<p class="f-date" data-reveal="up" style="--d:.15s">स्वागत समारंभ · शनिवार, दि. ०२ जानेवारी २०२७ · सायंकाळी ०७ ते रात्री ११ वा. पर्यंत</p>'],
  ['<p class="f-venue" data-reveal="up" style="--d:.18s">Lotus Inn Butterfly Lawn<br>Rahatgaon Ring Road, Amravati</p>', '<p class="f-venue" data-reveal="up" style="--d:.18s">लोटस इन बटरफ्लाय लॉन<br>रहाटगांव रिंग रोड, अमरावती</p>'],
  ['<p class="f-reg" data-reveal="up" style="--d:.2s">With Regards: Sau. Priya &amp; Prof. Dr. Sanjay Tirathkar, Ambagate, Amravati</p>', '<p class="f-reg" data-reveal="up" style="--d:.2s">सस्नेह निमंत्रण<br>सौ. प्रिया व प्रा.डॉ. संजयराव तिरथकर<br>अंबागेट, अमरावती</p>'],
  ['https://wa.me/919422838237?text=Hi%2C%20I%20will%20attend%20the%20wedding%20of%20Vedant%20and%20Vrishali.', 'https://wa.me/919422838237?text=' + encodeURIComponent(WA_MR)],
  ['<svg aria-hidden="true"><use href="#i-chat"/></svg>RSVP on WhatsApp</a>', '<svg aria-hidden="true"><use href="#i-chat"/></svg>व्हॉट्सॲपवर कळवा</a>'],
  ['<svg aria-hidden="true"><use href="#i-lantern"/></svg>Release a Wish Lantern</button>', '<svg aria-hidden="true"><use href="#i-lantern"/></svg>शुभेच्छा आकाशकंदील सोडा</button>'],
  ['<p class="f-rsvp" data-reveal="fade">RSVP: 9422838237 (Prof. Dr. Sanjay Tirathkar)</p>', '<p class="f-rsvp" data-reveal="fade">संपर्क: 9422838237 (प्रा.डॉ. संजयराव तिरथकर)</p>'],
  ['<p class="f-close" data-reveal="scale">Vedant with Vrishali</p>', `<p class="f-close" data-reveal="scale">वेदांत${S}वृषाली</p>`],

  // lightbox + calendar
  ['aria-label="Photo viewer"', 'aria-label="फोटो दर्शक"'],
  ['aria-label="Close photo viewer"', 'aria-label="फोटो दर्शक बंद करा"'],
  ['aria-label="Previous photo"', 'aria-label="मागील फोटो"'],
  ['aria-label="Next photo"', 'aria-label="पुढील फोटो"'],
  ["'SUMMARY:' + icsEscape('Wedding · Vedant & Vrishali')", "'SUMMARY:' + icsEscape('शुभविवाह · वेदांत व वृषाली')"],
  ["'LOCATION:' + icsEscape('Silver Star Celebration Hall, Shegaon-Rahatgaon Road, Amravati')", "'LOCATION:' + icsEscape('सिल्वर स्टार सेलीब्रेशन हॉल, शेगाव-रहाटगांव रोड, अमरावती (Silver Star Celebration Hall, Shegaon-Rahatgaon Road, Amravati)')"],
  ["const desc = 'Blessings Only'", "const desc = 'आहेर पध्दत पुर्णतः बंद....आपली उपस्थिती व आशिर्वादच अमुल्य....'"],
];

/* ---------- RECEPTION-ONLY PAGES ----------
   [english snippet, new english, marathi]  -  marathi: a string (replaces what MR gives for that snippet), true (the same
   code in both languages: apply the english pair to the Marathi page too) or null (english page only).
   new english null = leave the english page as it is. */
const RECEPTION_MAPS = "https://www.google.com/maps/search/?api=1&query=Lotus+Inn+Butterfly+Lawn%2C+Rahatgaon+Ring+Road%2C+Amravati";
const REC = [
  ['<title>Vedant &amp; Vrishali · Wedding Invitation</title>', '<title>Vedant &amp; Vrishali · Reception Invitation</title>', '<title>वेदांत 卐 वृषाली · स्वागत समारंभ</title>'],
  ['content="Wedding Invitation · Vedant with Vrishali · Friday, 1 January 2027, 10:30 AM · Silver Star Celebration Hall, Shegaon-Rahatgaon Road, Amravati"', 'content="Welcome Reception · Vedant with Vrishali · Saturday, 2 January 2027, 7:00 PM to 11:00 PM · Lotus Inn Butterfly Lawn, Rahatgaon Ring Road, Amravati"', 'content="स्वागत समारंभ · चि. वेदांत व चि.सौ.कां. वृषाली · शनिवार, दि. ०२ जानेवारी २०२७ · सायंकाळी ०७ ते रात्री ११ वा. पर्यंत · लोटस इन बटरफ्लाय लॉन, रहाटगांव रिंग रोड, अमरावती"'],
  ['<meta property="og:title" content="Vedant &amp; Vrishali · Wedding Invitation">', '<meta property="og:title" content="Vedant &amp; Vrishali · Reception Invitation">', '<meta property="og:title" content="वेदांत 卐 वृषाली · स्वागत समारंभ">'],
  ['<meta property="og:description" content="Friday, 1 January 2027 · 10:30 AM · Silver Star Celebration Hall, Shegaon-Rahatgaon Road, Amravati">', '<meta property="og:description" content="Saturday, 2 January 2027 · 7:00 PM to 11:00 PM · Lotus Inn Butterfly Lawn, Rahatgaon Ring Road, Amravati">', '<meta property="og:description" content="शनिवार, दि. ०२ जानेवारी २०२७ · सायंकाळी ०७ ते रात्री ११ वा. पर्यंत · लोटस इन बटरफ्लाय लॉन, रहाटगांव रिंग रोड, अमरावती">'],
  ['aria-label="Wedding invitation of Vedant and Vrishali. Press Tap to Open."', 'aria-label="Reception invitation of Vedant and Vrishali. Press Tap to Open."', 'aria-label="वेदांत व वृषाली यांचे स्वागत समारंभ निमंत्रण. उघडण्यासाठी टॅप करा."'],
  ['<p class="hero-sub" data-h style="--d:2.3s">Wedding Invitation</p>', '<p class="hero-sub" data-h style="--d:2.3s">Welcome Reception</p>', '<p class="hero-sub" data-h style="--d:2.3s">॥ स्वागत समारंभ ॥</p>'],
  ['<p class="hero-date" data-h style="--d:2.5s"><span>Friday</span><i aria-hidden="true"></i><span>1 January 2027</span><i aria-hidden="true"></i><span>10:30 AM</span></p>', '<p class="hero-date" data-h style="--d:2.5s"><span>Saturday</span><i aria-hidden="true"></i><span>2 January 2027</span><i aria-hidden="true"></i><span>7:00 PM</span></p>', '<p class="hero-date" data-h style="--d:2.5s"><span>शनिवार, दि. ०२ जानेवारी २०२७</span><i aria-hidden="true"></i><span>सायंकाळी ०७ ते रात्री ११ वा. पर्यंत</span></p>'],
  ['<span>Wedding Ceremony</span></span></h2>', '<span>Welcome Reception</span></span></h2>', '<span>॥&nbsp;स्वागत&nbsp;समारंभ&nbsp;॥</span></span></h2>'],
  ['<p class="sub" data-reveal="up" style="--d:.3s">Friday · 1 January 2027</p>', '<p class="sub" data-reveal="up" style="--d:.3s">Saturday · 2 January 2027</p>', '<p class="sub" data-reveal="up" style="--d:.3s">शनिवार, दि. ०२ जानेवारी २०२७</p>'],
  ['<p class="sub" data-reveal="up" style="--d:.3s">1 – 2 January 2027</p>', '<p class="sub" data-reveal="up" style="--d:.3s">Saturday · 2 January 2027</p>', '<p class="sub" data-reveal="up" style="--d:.3s">शनिवार, दि. ०२ जानेवारी २०२७</p>'],
  ['<p class="c-req">WE REQUEST YOUR GRACIOUS PRESENCE FOR THE WEDDING CEREMONY OF</p>', '<p class="c-req">WE REQUEST YOUR GRACIOUS PRESENCE AT THE WELCOME RECEPTION OF</p>', '<p class="c-req">॥ स्वागत समारंभ व प्रितीभोज ॥</p>'],
  ['<p class="c-bo">BLESSINGS ONLY</p>', '<p class="c-bo">KINDLY ATTEND AND BLESS THE COUPLE</p>', '<p class="c-bo">यांच्या विवाह प्रित्यर्थ आयोजित स्वागत समारंभ व स्वरूची भोजनास उपस्थित राहून वधू-वरास शुभाशिर्वाद द्यावे ही विनंती.</p>'],
  ['<p class="b-title">Wedding Ceremony</p>', '<p class="b-title">Welcome Reception &amp; Dinner</p>', '<p class="b-title">स्वागत समारंभ व प्रितीभोज</p>'],
  ['<span class="b-side">Friday</span>', '<span class="b-side">Saturday</span>', '<span class="b-side">शनिवार</span>'],
  ['<span class="b-main"><span>January</span><b>01</b><span>2027</span></span>', '<span class="b-main"><span>January</span><b>02</b><span>2027</span></span>', '<span class="b-main"><span>जानेवारी</span><b>२</b><span>२०२७</span></span>'],
  ['<span class="b-side">10:30 AM</span>', '<span class="b-side">7:00 PM<br>to 11:00 PM</span>', '<span class="b-side">सायंकाळी ०७ ते<br>रात्री ११ वा.</span>'],
  ['<p class="b-venue">Silver Star Celebration Hall</p>', '<p class="b-venue">Lotus Inn Butterfly Lawn</p>', '<p class="b-venue">लोटस इन बटरफ्लाय लॉन</p>'],
  ['<p class="b-addr">Shegaon-Rahatgaon Road, Amravati</p>', '<p class="b-addr">Rahatgaon Ring Road, Amravati</p>', '<p class="b-addr">रहाटगांव रिंग रोड<br>अमरावती</p>'],
  ['<p class="b-vl">Venue</p>', null, '<p class="b-vl">स्थळ</p>'],
  ['<p class="b-rl">With Regards:</p>', null, '<p class="b-rl">विनीत</p>'],
  ['<p class="b-reg">Sau. Priya &amp; Prof. Dr. Sanjay Tirathkar</p>', null, '<p class="b-reg">प्रा.डॉ. संजय श्रीधरराव तिरथकर</p>'],
  ['<p class="b-reg2">Inside Ambagate, Amravati</p>', null, '<p class="b-reg2">सौ. प्रिया संजयराव तिरथकर</p>'],
  ['<p class="eyebrow" data-reveal="fade">Save the Date</p>', null, '<p class="eyebrow" data-reveal="fade">स्वागत समारंभ</p>'],
  ['<p class="cd-sub" data-reveal="up" style="--d:.4s">1 January 2027 · 10:30 AM IST</p>', '<p class="cd-sub" data-reveal="up" style="--d:.4s">2 January 2027 · 7:00 PM IST</p>', '<p class="cd-sub" data-reveal="up" style="--d:.4s">शनिवार, दि. ०२ जानेवारी २०२७ · सायंकाळी ०७ वा.</p>'],
  ['<p class="sub" data-reveal="up" style="--d:.3s">Silver Star Celebration Hall</p>', '<p class="sub" data-reveal="up" style="--d:.3s">Lotus Inn Butterfly Lawn</p>', '<p class="sub" data-reveal="up" style="--d:.3s">लोटस इन बटरफ्लाय लॉन</p>'],
  ['<p class="v-lab">Date</p><p class="v-val">1 January 2027</p><p class="v-small">Friday</p>', '<p class="v-lab">Date</p><p class="v-val">2 January 2027</p><p class="v-small">Saturday</p>', '<p class="v-lab">दिनांक</p><p class="v-val">२ जानेवारी २०२७</p><p class="v-small">शनिवार</p>'],
  ['<p class="v-lab">Time</p><p class="v-val">10:30 AM</p><p class="v-small">IST</p>', '<p class="v-lab">Time</p><p class="v-val">7:00 PM</p><p class="v-small">to 11:00 PM IST</p>', '<p class="v-lab">वेळ</p><p class="v-val">सायं. ०७ वा.</p><p class="v-small">रात्री ११ वा. पर्यंत</p>'],
  ['<p class="v-lab">Venue</p><p class="v-val">Silver Star Celebration Hall</p><p class="v-small">Shegaon-Rahatgaon Road, Amravati</p>', '<p class="v-lab">Venue</p><p class="v-val">Lotus Inn Butterfly Lawn</p><p class="v-small">Rahatgaon Ring Road, Amravati</p>', '<p class="v-lab">स्थळ</p><p class="v-val">लोटस इन बटरफ्लाय लॉन</p><p class="v-small">रहाटगांव रिंग रोड, अमरावती</p>'],
  ['<h4>Wedding Muhurat</h4><p>Margashirsha Krishna 9, Shaka 1948<br>Friday, 1 January 2027<br>10:30 AM</p>', '<h4>Reception Time</h4><p>Saturday, 2 January 2027<br>7:00 PM to 11:00 PM</p>', '<h4>* स्वागत समारंभ *</h4><p class="dev" lang="mr">शनिवार, दि. २ जानेवारी २०२७<br>सायंकाळी ०७ ते रात्री ११ वा. पर्यंत</p>'],
  ['<h4>Wedding Venue</h4><p>Silver Star<br>Celebration Hall<br>Shegaon-Rahatgaon Road<br>Amravati</p>', '<h4>Reception Venue</h4><p>Lotus Inn<br>Butterfly Lawn<br>Rahatgaon Ring Road<br>Amravati</p>', '<h4>* स्थळ *</h4><p class="dev" lang="mr">लोटस इन<br>बटरफ्लाय लॉन<br>रहाटगांव रिंग रोड<br>अमरावती</p>'],
  ['maps?q=Silver+Star+Celebration+Hall,+Shegaon-Rahatgaon+Road,+Amravati&amp;z=16', 'maps?q=Lotus+Inn+Butterfly+Lawn,+Rahatgaon+Ring+Road,+Amravati&amp;z=16', true],
  ['&amp;hl=en&amp;output=embed" title="Google Maps: Silver Star Celebration Hall, Shegaon-Rahatgaon Road, Amravati"', '&amp;hl=en&amp;output=embed" title="Google Maps: Lotus Inn Butterfly Lawn, Rahatgaon Ring Road, Amravati"', '&amp;hl=mr&amp;output=embed" title="Google नकाशा: लोटस इन बटरफ्लाय लॉन, रहाटगांव रिंग रोड, अमरावती"'],
  ['<span class="map-label">Silver Star Celebration Hall</span><span class="map-addr">Shegaon-Rahatgaon Road, Amravati</span>', '<span class="map-label">Lotus Inn Butterfly Lawn</span><span class="map-addr">Rahatgaon Ring Road, Amravati</span>', '<span class="map-label">लोटस इन बटरफ्लाय लॉन</span><span class="map-addr">रहाटगांव रिंग रोड, अमरावती</span>'],
  ['<span>Wedding &amp; Reception</span></span></h2>', '<span>Reception</span></span></h2>', '<span>स्वागत समारंभ</span></span></h2>'],
  ['<span class="tl-marker" aria-hidden="true">2</span>', '<span class="tl-marker" aria-hidden="true">1</span>', true],
  ['<p class="f-bo" data-reveal="fade">Blessings Only</p>', '<p class="f-bo" data-reveal="fade">Your presence and blessings are requested</p>', '<p class="f-bo" data-reveal="fade">उपस्थित राहून वधू-वरास शुभाशिर्वाद द्यावे ही विनंती.</p>'],
  ['<p class="f-date" data-reveal="up">Friday · 1 January 2027 · 10:30 AM</p>', '<p class="f-date" data-reveal="up">Saturday · 2 January 2027 · 7:00 PM to 11:00 PM</p>', '<p class="f-date" data-reveal="up">शनिवार, दि. ०२ जानेवारी २०२७ · सायंकाळी ०७ ते रात्री ११ वा. पर्यंत</p>'],
  ['<p class="f-venue" data-reveal="up" style="--d:.1s">Silver Star Celebration Hall<br>Shegaon-Rahatgaon Road, Amravati</p>', '<p class="f-venue" data-reveal="up" style="--d:.1s">Lotus Inn Butterfly Lawn<br>Rahatgaon Ring Road, Amravati</p>', '<p class="f-venue" data-reveal="up" style="--d:.1s">लोटस इन बटरफ्लाय लॉन<br>रहाटगांव रिंग रोड, अमरावती</p>'],
  ['https://wa.me/919422838237?text=Hi%2C%20I%20will%20attend%20the%20wedding%20of%20Vedant%20and%20Vrishali.', 'https://wa.me/919422838237?text=Hi%2C%20I%20will%20attend%20the%20reception%20of%20Vedant%20and%20Vrishali.', 'https://wa.me/919422838237?text=' + encodeURIComponent("नमस्कार, मी वेदांत व वृषाली यांच्या स्वागत समारंभाला उपस्थित राहीन.")],
  ["  TARGET: Date.UTC(2027, 0, 1, 10, 30) - 5.5 * 3600 * 1000, // 1 January 2027, 10:30 AM IST (+05:30)", "  TARGET: Date.UTC(2027, 0, 2, 19, 0) - 5.5 * 3600 * 1000, // 2 January 2027, 7:00 PM IST (+05:30)", true],
  ["  MAPS_URL: 'https://maps.app.goo.gl/hePZznCq4gRpgGm9A', // Silver Star Celebration Hall, Amravati (given by the couple)", `  MAPS_URL: '${RECEPTION_MAPS}', // Lotus Inn Butterfly Lawn (a Google Maps search made from the printed address)`, true],
  ["ICS_NAME: 'Vedant-Vrishali-Wedding.ics'", "ICS_NAME: 'Vedant-Vrishali-Reception.ics'", true],
  ["'UID:vedant-vrishali-wedding-20270101@invitation'", "'UID:vedant-vrishali-reception-20270102@invitation'", true],
  ["'DTSTART;TZID=Asia/Kolkata:20270101T103000', 'DTEND;TZID=Asia/Kolkata:20270101T143000'", "'DTSTART;TZID=Asia/Kolkata:20270102T190000', 'DTEND;TZID=Asia/Kolkata:20270102T230000'", true],
  ["'PRODID:-//Vedant and Vrishali//Wedding Invitation//EN'", "'PRODID:-//Vedant and Vrishali//Reception Invitation//EN'", true],
  ["'SUMMARY:' + icsEscape('Wedding · Vedant & Vrishali')", "'SUMMARY:' + icsEscape('Welcome Reception · Vedant & Vrishali')", "'SUMMARY:' + icsEscape('स्वागत समारंभ · वेदांत व वृषाली')"],
  ["'LOCATION:' + icsEscape('Silver Star Celebration Hall, Shegaon-Rahatgaon Road, Amravati')", "'LOCATION:' + icsEscape('Lotus Inn Butterfly Lawn, Rahatgaon Ring Road, Amravati')", "'LOCATION:' + icsEscape('लोटस इन बटरफ्लाय लॉन, रहाटगांव रिंग रोड, अमरावती (Lotus Inn Butterfly Lawn, Rahatgaon Ring Road, Amravati)')"],
  ["const desc = 'Blessings Only'", "const desc = 'Welcome Reception & Dinner'", "const desc = 'स्वागत समारंभ व प्रितीभोज'"],
];

/* ---------- helpers ---------- */
function applyAll(html, pairs, label) {
  const misses = [];
  for (const [from, to, mode] of pairs) {
    const n = from instanceof RegExp ? (html.match(new RegExp(from.source, "g")) || []).length : html.split(from).length - 1;
    if (n === 0) { misses.push(String(from).slice(0, 110)); continue; }
    if (from instanceof RegExp) html = html.replace(from, to);
    else html = mode === "all" ? html.split(from).join(to) : html.replace(from, () => to);
  }
  if (misses.length) { console.error(`MISSING ${misses.length} replacement(s) in ${label}:\n  ` + misses.join("\n  ")); process.exit(1); }
  return html;
}
const mrOf = (key) => {
  const p = MR.find(([f]) => f === key);
  if (!p) { console.error("REC pair has no Marathi base pair: " + key.slice(0, 110)); process.exit(1); }
  return p;
};
const stripMarks = (h) => h.replace(/<!--@\/?(w|album)-->/g, "");
const dropWedding = (h) => h.replace(/<!--@w-->[\s\S]*?<!--@\/w-->/g, "");

// the album is not part of the groom's-side sites
// the notes comment at the top of the template stays in the source only
const T1 = T0.replace(/<!--\n=+\n[\s\S]*?\n-->\n?/, "");
let BASE = ALBUM ? T1 : T1.replace(/<!--@album-->[\s\S]*?<!--@\/album-->/g, "");
if (!ALBUM && /<!--GALLERY-->/.test(BASE)) { console.error("album block not removed"); process.exit(1); }

/* ---------- the four page sets ---------- */
const weddingEn = stripMarks(BASE);
const weddingMr = stripMarks(applyAll(BASE, MR, "Marathi (wedding + reception)"));

const recEnPairs = REC.filter((r) => r[1] !== null).map(([f, e]) => [f, e]);
const recEn = applyAll(dropWedding(BASE), recEnPairs, "reception English");
const mrFull = applyAll(BASE, MR, "Marathi (for reception)");
const recMrPairs = REC.filter((r) => r[2] !== null).map(([f, e, m]) => {
  if (m === true) return [f, e];
  const base = mrOf(f);
  return [base[0] instanceof RegExp ? base[0] : base[1], m, base[2]];
});
// pairs whose English text the Marathi page does not carry (same code in both) must come first, so Marathi keys stay intact
const recMr = applyAll(dropWedding(mrFull), recMrPairs, "reception Marathi");

/* ---------- link previews, canonical URLs, search engines ---------- */
const ICON = '<link rel="icon" href="data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="31" fill="#5C2330" stroke="#C9A96A" stroke-width="2"/><text x="32" y="42" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-size="26" fill="#E8D3A0">V&amp;V</text></svg>') + '">';
const THEME_TAG = '<meta name="theme-color" content="#5C2330">';
const THEME = ICON + "\n" + THEME_TAG;
const addMeta = (h, m) => {
  if (h.split(THEME_TAG).length !== 2) { console.error("theme-color meta must appear exactly once"); process.exit(1); }
  return h.replace(THEME_TAG, () => m + THEME);
};
// The English page must still contain every English line exactly as typed.
const mustHave = (html, list, label) => { for (const m of list) if (!html.includes(m)) { console.error(`${label} check failed, missing: ${m}`); process.exit(1); } };
const mustNot = (html, list, label) => { for (const m of list) if (html.includes(m)) { console.error(`${label} check failed, still contains: ${m}`); process.exit(1); } };
const BRIDE_ONLY = ["7709806289", "Surali", "Warud"];
mustHave(weddingEn, ["Vedant", "Vrishali", "(S/o Mrs. Priya &amp; Prof. Dr. Sanjay Tirathkar)", "(D/o. Mrs. Archana &amp; Mr. Subhash Gulhane)", "Silver Star Celebration Hall", "Shegaon-Rahatgaon Road, Amravati", "10:30 AM", "1 January 2027", "Lotus Inn Butterfly Lawn", "2 January 2027", "7:00 PM to 11:00 PM", "Sau. Priya &amp; Prof. Dr. Sanjay Tirathkar", "Inside Ambagate, Amravati", "With Regards: Sau. Priya &amp; Prof. Dr. Sanjay Tirathkar, Ambagate, Amravati", "919422838237", "9422838237", "Saptapadi"], "wedding English");
mustNot(weddingEn, [...BRIDE_ONLY, "Photo Album"], "wedding English");
mustHave(recEn, ["Vedant", "Vrishali", "Lotus Inn Butterfly Lawn", "Rahatgaon Ring Road, Amravati", "2 January 2027", "7:00 PM", "Saturday", "919422838237", "Ambagate, Amravati"], "reception English");
mustNot(recEn, [...BRIDE_ONLY, "Silver Star", "Shegaon", "10:30", "Friday", "1 January 2027", 'id="saptapadi"', ">Saptapadi<", "Wedding Muhurat", "<!--@"], "reception English");
mustHave(weddingMr, ["वेदांत", "वृषाली", "लोटस इन बटरफ्लाय लॉन", "सिल्वर स्टार सेलीब्रेशन हॉल", "9422838237"], "wedding Marathi");
mustNot(weddingMr, [...BRIDE_ONLY, "<!--@"], "wedding Marathi");
mustHave(recMr, ["वेदांत", "वृषाली", "लोटस इन बटरफ्लाय लॉन", "शनिवार", "9422838237"], "reception Marathi");
mustNot(recMr, [...BRIDE_ONLY, "सिल्वर स्टार", "शेगाव", "सप्तपदी", "१०.३०", "१० वा. ३०", "शुक्रवार", "<!--@"], "reception Marathi");

/* ---------- write dist/ ---------- */
rmSync(OUT, { recursive: true, force: true });
const SETS = [
  { dir: "", up: "../", img: ["og-en.jpg", "og-mr.jpg"], en: weddingEn, mr: weddingMr, title: "Vedant &amp; Vrishali · Wedding &amp; Reception Invitation · वेदांत 卐 वृषाली", desc: "Wedding: Friday, 1 January 2027 · 10:30 AM · Silver Star Celebration Hall, Amravati. Reception: Saturday, 2 January 2027 · 7:00 PM · Lotus Inn Butterfly Lawn, Amravati" },
  { dir: "rec/", up: "../../", img: ["og-reception-en.jpg", "og-reception-mr.jpg"], en: recEn, mr: recMr, title: "Vedant &amp; Vrishali · Reception Invitation · वेदांत 卐 वृषाली", desc: "Saturday, 2 January 2027 · 7:00 PM to 11:00 PM · Lotus Inn Butterfly Lawn, Rahatgaon Ring Road, Amravati" },
];
for (const s of SETS) {
  mkdirSync(new URL(`./${s.dir}en/`, OUT), { recursive: true });
  mkdirSync(new URL(`./${s.dir}ma/`, OUT), { recursive: true });
  const enPath = `/${s.dir}en/`, mrPath = `/${s.dir}ma/`;
  const alt = `<link rel="alternate" hreflang="en" href="${SITE}${enPath}">\n<link rel="alternate" hreflang="mr" href="${SITE}${mrPath}">\n<link rel="alternate" hreflang="x-default" href="${SITE}/${s.dir}">`;
  const metaFor = (path, locale, img) => `<meta name="robots" content="noindex">
<link rel="canonical" href="${SITE}${path}">
${alt}
<meta property="og:type" content="website">
<meta property="og:url" content="${SITE}${path}">
<meta property="og:locale" content="${locale}">
<meta property="og:image" content="${SITE}/assets/${img}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
`;
  writeFileSync(new URL(`./${s.dir}en/index.html`, OUT), addMeta(fixPaths(s.en, s.up), metaFor(enPath, "en_IN", s.img[0])));
  writeFileSync(new URL(`./${s.dir}ma/index.html`, OUT), addMeta(fixPaths(s.mr, s.up), metaFor(mrPath, "mr_IN", s.img[1])));
  const PLAIN_CSS = "body{margin:0;min-height:100vh;display:grid;place-items:center;text-align:center;background:#5C2330;color:#F6EBCB;font-family:Georgia,serif}a{display:inline-block;color:#E8D3A0;font-size:20px;margin:0 8px;padding:12px 16px;min-height:44px;box-sizing:border-box}p{font-size:18px}";
  // Root page of each site: remembers the last language chosen with the toggle, else browser language, else English.
  writeFileSync(new URL(`./${s.dir}index.html`, OUT), `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${s.title}</title>
<meta name="description" content="${s.desc}">
<meta property="og:title" content="${s.title}">
<meta property="og:description" content="${s.desc}">
${metaFor("/" + s.dir, "en_IN", s.img[0])}${THEME}
<script>
  (function () {
    var l = null;
    try { l = localStorage.getItem('vv-lang'); } catch (e) {}
    if (!l) l = /^mr\\b/i.test(navigator.language || '') ? 'mr' : 'en';
    var d = l === 'mr' ? 'ma' : 'en';
    location.replace(location.protocol === 'file:' ? ${JSON.stringify(s.dir)} + d + '/index.html' : '/${s.dir}' + d + '/');
  })();
</script>
<style>${PLAIN_CSS}</style>
</head>
<body><p><a href="/${s.dir}en/">English</a> <a href="/${s.dir}ma/" lang="mr">मराठी</a></p></body>
</html>
`);
}

// Site files: only what the pages use (web images, previews). Masters/raw/ref stay out.
mkdirSync(new URL("./assets/flow/", OUT), { recursive: true });
const FLOW = new URL("./assets/flow/", import.meta.url);
for (const f of existsSync(FLOW) ? readdirSync(FLOW) : []) {
  if (f.endsWith(".webp")) cpSync(new URL(f, FLOW), new URL("./assets/flow/" + f, OUT));
}
mkdirSync(new URL("./assets/audio/", OUT), { recursive: true });
for (const f of ["instrumental.mp3", "verse.mp3"]) {
  const src = new URL("./assets/audio/" + f, import.meta.url);
  if (existsSync(src)) cpSync(src, new URL("./assets/audio/" + f, OUT)); else console.warn("WARNING: assets/audio/" + f + " missing");
}
if (ALBUM) {
  const GALLERY = JSON.parse(readFileSync(new URL("./src/gallery.json", import.meta.url), "utf8"));
  mkdirSync(new URL("./assets/photos/", OUT), { recursive: true });
  for (const p of GALLERY) for (const f of [`${p.id}.webp`, `${p.id}t.webp`]) cpSync(new URL("./assets/photos/" + f, import.meta.url), new URL("./assets/photos/" + f, OUT));
}
// Link previews are made from the built site by _tools/og.mjs, so on the very first build they may not exist yet.
for (const f of ["og-en.jpg", "og-mr.jpg", "og-reception-en.jpg", "og-reception-mr.jpg"]) {
  const src = new URL("./assets/" + f, import.meta.url);
  if (existsSync(src)) cpSync(src, new URL("./assets/" + f, OUT)); else console.warn("WARNING: assets/" + f + " missing: run _tools/og.mjs, then build again");
}
for (const n of [1, 2, 3, 4]) {
  const src = new URL(`./photo${n}.jpg`, import.meta.url);
  if (existsSync(src)) cpSync(src, new URL(`./photo${n}.jpg`, OUT));
}

// 404 page (also stops Pages from serving the root page for every unknown path).
writeFileSync(new URL("./404.html", OUT), `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Page not found · Vedant &amp; Vrishali</title>
<meta name="robots" content="noindex">
${THEME}
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;text-align:center;background:#5C2330;color:#F6EBCB;font-family:Georgia,serif}a{display:inline-block;color:#E8D3A0;font-size:20px;margin:0 8px;padding:12px 16px;min-height:44px;box-sizing:border-box}p{font-size:18px}</style>
</head>
<body><div><p>This page does not exist. · हे पान उपलब्ध नाही.</p><p><a href="/en/">Wedding &amp; Reception</a> <a href="/rec/en/">Reception</a> <a href="/ma/" lang="mr">विवाह व स्वागत समारंभ</a> <a href="/rec/ma/" lang="mr">स्वागत समारंभ</a></p></div></body>
</html>
`);

// Cloudflare Pages headers. Pages already sends nosniff and a referrer policy.
writeFileSync(new URL("./_headers", OUT), `/*
  X-Frame-Options: SAMEORIGIN
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  X-Robots-Tag: noindex
`);

console.log("built dist/ for " + SITE + `  (wedding en ${weddingEn.length} / ma ${weddingMr.length}; reception en ${recEn.length} / ma ${recMr.length})`);
