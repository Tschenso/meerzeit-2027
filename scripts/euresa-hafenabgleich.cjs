'use strict';
// Geprüfte Ausnahmen für konkrete Reisen; keine globale Gleichsetzung von Häfen.
const sommer='https://assets.ctfassets.net/ewp1r825fxg0/5ubk9BgDan2cp61LSFOL24/05770c77f1cf55ff8def556f10b1875f/Mein_Schiff_Logbuch_Summer_2027_EN_web_202604.pdf';
const winter='https://corporate.tuicruises.com/de/press/releases/mein-schiff-begeistert-mit-vielfaeltigen-reisen-im-winter-202728-neue-routen';
const rows=[
  ['MSS2713SEE','2027-07-08','2027-07-15'],['MSS271314SEE','2027-07-08','2027-07-22'],
  ['MSS2714SEE','2027-07-15','2027-07-22'],['MSS271415SEE','2027-07-15','2027-07-29'],
  ['MSS2715SEE','2027-07-22','2027-07-29'],['MSS271516SEE','2027-07-22','2027-08-05'],
  ['MSS2716SEE','2027-07-29','2027-08-05'],['MSS271617SEE','2027-07-29','2027-08-12'],
  ['MSS2717SEE','2027-08-05','2027-08-12'],['MSS271718SEE','2027-08-05','2027-08-19'],
  ['MSS2718SEE','2027-08-12','2027-08-19'],['MSS271819SEE','2027-08-12','2027-08-30'],
  ['MSS2719SEE','2027-08-19','2027-08-30'],
  ['MSE2731SEE','2027-08-30','2027-09-14'],['MSE2732SEE','2027-09-14','2027-09-28'],
  ['MSE2733SEE','2027-09-28','2027-10-08'],['MSE2734SEE','2027-10-08','2027-10-19'],
  ['MSE2735SEE','2027-10-19','2027-10-29'],['MSE2736SEE','2027-10-29','2027-11-10'],
  ['MSE273637SEE','2027-10-29','2027-11-17']
];
function reviewedPort(trip,actual,expected){
  const row=rows.find(r=>r[0]===trip.euresaCode&&r[1]===trip.start&&r[2]===trip.end);
  if(!row||trip.operator!=='Mein Schiff')return null;
  if(trip.ship==='Mein Schiff 6'&&row[0].startsWith('MSS')&&expected==='Porto'&&actual==='Leixões (Porto)')return {label:'Leixões (Porto)',proofUrl:sommer};
  if(trip.ship==='Mein Schiff 1'&&row[0].startsWith('MSE')&&expected==='Cape Liberty'&&actual==='New York City')return {label:'Bayonne / Cape Liberty (New York)',proofUrl:trip.start<'2027-10-29'?sommer:winter};
  return null;
}
module.exports={reviewedPort};
