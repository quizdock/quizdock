# Glossary

The vocabulary of QuizDock's interface, in every shipped locale, and the
choices behind it. The tables below cover the original five locales; the terms
of the later ones (Turkish, German, Hindi, Italian, Japanese, Polish, Russian)
are listed after them. It extends the canonical glossary ratified in
[ADR 0001](../../../../docs/adr/0001-i18n-et-glossaire.md) (quiz / session /
participant / animateur / PIN) to every term the interface has grown since. Keep it in step with the `locales/*.json` files: when a term
changes, change it here and everywhere it appears (the parity test only checks
keys, not wording). Values below are copied from the dictionaries — `en` is the
reference, the others follow its sense, not its words.

## Roles and places

| Term        | en                      | fr                   | es                   | zh            | zh-TW         | Where                                                                                                                                                                       |
| ----------- | ----------------------- | -------------------- | -------------------- | ------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| quiz        | quiz                    | quiz                 | quiz                 | 测验          | 測驗          | everywhere                                                                                                                                                                  |
| my quizzes  | My quizzes              | Mes quiz             | Mis quizzes          | 我的测验      | 我的測驗      | topbar, `/quizzes`                                                                                                                                                          |
| editor      | Editor                  | Éditeur              | Editor               | 编辑器        | 編輯器        | `/quizzes/:id`                                                                                                                                                              |
| host        | Quiz host (role) / host | Animateur            | Anfitrión            | 主持人        | 主持人        | live                                                                                                                                                                        |
| host seat   | Host seat               | Siège hôte           | Asiento de anfitrión | 主持席位      | 主持席位      | local auth mode                                                                                                                                                             |
| participant | Participant             | Participant          | Participante         | 参与者        | 參與者        | live, console tab                                                                                                                                                           |
| nickname    | Nickname                | Pseudo               | Apodo                | 昵称          | 匿稱          | join                                                                                                                                                                        |
| lobby       | Lobby                   | Salon                | Sala                 | 房间          | 房間          | live: what one joins with the PIN and stays in, several quizzes in a row and the wait between them (#89); one word only — never _room_ in en, never _salle d’attente_ in fr |
| on site     | On site                 | Dans la salle        | Presencial           | 在现场        | 在現場        | live: a participant physically present, as opposed to following from home; never the lobby’s word                                                                           |
| session     | Session                 | Session              | Sesión               | 会话          | 會話          | afterwards: one quiz played in a lobby, as _History_ keeps it                                                                                                               |
| console     | Console                 | Console              | Consola              | 控制台        | 控制台        | `/session/:pin/console`                                                                                                                                                     |
| projection  | Projection              | Projection           | Proyección           | 投影          | 投影          | `/session/:pin/projection`                                                                                                                                                  |
| join / PIN  | Join · PIN code         | Rejoindre · Code PIN | Unirse · Código PIN  | 加入 · PIN 码 | 加入 · PIN 碼 | `/join`                                                                                                                                                                     |
| reviews     | Reviews                 | Avis                 | Opiniones            | 评价          | 回饋          | `/quizzes/:id/reviews`                                                                                                                                                      |
| history     | History                 | Historique           | Historial            | 历史          | 歷史          | `/quizzes/:id/history`                                                                                                                                                      |
| templates   | Templates               | Modèles              | Plantillas           | 模板          | 範本          | `/templates`: copies offered to the instance's hosts (RG-17)                                                                                                                |
| selection   | Selection               | Sélection            | Selección            | 选集          | 選集          | `/selections`: a named list of quizzes launched into a lobby                                                                                                                |

## Content

| Term                            | en                              | fr                                    | es                                   | zh                   | zh-TW                |
| ------------------------------- | ------------------------------- | ------------------------------------- | ------------------------------------ | -------------------- | -------------------- |
| question                        | Question                        | Question                              | Pregunta                             | 题目                 | 題目                 |
| slide                           | Slide                           | Slide                                 | Diapositiva                          | 幻灯片               | 簡報                 |
| answer choice                   | Answer choice                   | Choix de réponse                      | Opción de respuesta                  | 选项                 | 選項                 |
| image choice                    | Image choice                    | Choix en images                       | Elección con imágenes                | 图片选择             | 圖片選擇             |
| alternative text                | Alternative text                | Texte alternatif                      | Texto alternativo                    | 替代文字             | 替代文字             |
| explanation                     | Explanation                     | Explication                           | Explicación                          | 解析                 | 解析                 |
| background                      | Background                      | Fond                                  | Fondo                                | 背景                 | 背景                 |
| outline (text halo)             | Outline (halo, like subtitles)  | Contour (halo, comme des sous-titres) | Contorno (halo, como subtítulos)     | 描边（光晕，如字幕） | 描邊（光暈，如字幕） |
| draft / ready / archived        | Draft / Ready / Archived        | Brouillon / Prêt / Archivé            | Borrador / Listo / Archivado         | 草稿 / 就绪 / 已归档 | 草稿 / 就緒 / 已歸檔 |
| publish                         | Publish (ready)                 | Publier (prêt)                        | Publicar (listo)                     | 发布（就绪）         | 發布（就緒）         |
| present                         | Present                         | Présenter                             | Presentar                            | 演示                 | 示範                 |
| import / export                 | Import / Export                 | Importer / Exporter                   | Importar / Exportar                  | 导入 / 导出          | 匯入 / 匯出          |
| share (with the hosts)          | Share                           | Partager                              | Compartir                            | 共享                 | 分享                 |
| offer as a template             | Offer as a template             | Proposer comme modèle                 | Ofrecer como plantilla               | 作为模板提供         | 作為範本提供         |
| present without keeping results | Present without keeping results | Présenter sans garder les résultats   | Presentar sin guardar los resultados | 不保留结果地演示     | 不保留結果地示範     |

A _selection_ (de _Auswahl_, it _Selezione_, pl _Zestaw_, ru _Подборка_, tr _Seçki_,
hi _चयन_, ja _セレクション_) lines quizzes up for a lobby; never _playlist_, _programme_
or _series_ (the streak).

_Share_ is only the instance sharing: the original, which the other hosts read, present
without keeping results, or create a quiz from. Putting a copy in the catalogue is
_offering it as a template_, never _sharing_ it, and _publish_ stays the move from draft
to ready.

## Play

| Term                | en                  | fr                             | es                             | zh           | zh-TW        |
| ------------------- | ------------------- | ------------------------------ | ------------------------------ | ------------ | ------------ |
| reveal              | Reveal              | Révéler                        | Revelar                        | 揭晓         | 揭曉         |
| leaderboard         | Leaderboard         | Classement                     | Clasificación                  | 排行榜       | 排行榜       |
| podium              | Podium              | Podium                         | Podio                          | 领奖台       | 領獎台       |
| leave               | Leave               | Quitter                        | Salir                          | 退出         | 離開         |
| stop (a quiz)       | Stop the quiz       | Arrêter le quiz                | Detener el quiz                | 停止测验     | 停止測驗     |
| close (the lobby)   | Close the lobby     | Fermer le salon                | Cerrar la sala                 | 关闭房间     | 關閉房間     |
| looking back        | Looking back        | Retour en arrière              | Mirando atrás                  | 回顾         | 回顧         |
| back to live        | Back to live        | Revenir au direct              | Volver al directo              | 回到当前     | 回到目前     |
| full answer capture | Full answer capture | Capture intégrale des réponses | Captura completa de respuestas | 完整记录回答 | 完整記錄回答 |

## Scoring

| Term           | en                     | fr                        | es                            | zh                 | zh-TW              |
| -------------- | ---------------------- | ------------------------- | ----------------------------- | ------------------ | ------------------ |
| scoring (rule) | Scoring                | Barème                    | Puntuación                    | 计分规则           | 計分規則           |
| closest wins   | Closest answer wins    | Le plus proche gagne      | Gana la más cercana           | 最接近者胜         | 最接近者勝         |
| partial credit | Partial credit         | Crédit partiel            | Crédito parcial               | 部分得分           | 部分得分           |
| tolerate typos | Tolerate typos         | Tolérant aux fautes       | Tolerar erratas               | 容忍拼写错误       | 容忍拼字錯誤       |
| double points  | Double                 | Double                    | Doble                         | 双倍               | 雙倍               |
| fixed points   | Fixed (no speed bonus) | Fixe (sans bonus vitesse) | Fijo (sin bonus de velocidad) | 固定（无速度加分） | 固定（無速度加分） |

## Decisions

### Turkish (`tr`)

| Concept                   | Turkish                | Usage                                                                                           |
| ------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------- |
| quiz                      | quiz                   | The authored content, distinct from the lobby and archived session.                             |
| my quizzes                | Quizlerim              | The quiz bank.                                                                                  |
| host                      | sunucu                 | The person presenting; never the server computer.                                               |
| host seat                 | sunucu yetkisi         | The single-host lock in local mode.                                                             |
| participant               | katılımcı              | The person answering, not “oyuncu”.                                                             |
| nickname                  | takma ad               | The name chosen when joining.                                                                   |
| lobby                     | oda                    | The lobby joined with a PIN: several quizzes in a row and the wait between them; one word only. |
| session                   | oturum                 | One completed quiz as shown in History.                                                         |
| console                   | kontrol paneli         | The host's control screen.                                                                      |
| projection                | yansıtma ekranı        | The shared screen seen in the lobby.                                                            |
| reveal                    | yanıtları göster       | The action that shows correct answers.                                                          |
| leaderboard               | sıralama               | Live standings.                                                                                 |
| podium                    | ödül kürsüsü           | Final standings.                                                                                |
| reviews                   | değerlendirmeler       | Ratings and comments from participants.                                                         |
| history                   | geçmiş                 | Archived sessions and results.                                                                  |
| question / slide / option | soru / slayt / seçenek | Quiz content.                                                                                   |
| scoring / partial credit  | puanlama / kısmi puan  | How points are awarded.                                                                         |
| leave / stop / close      | ayrıl / durdur / kapat | A participant leaves the lobby; the host stops a quiz, closes the lobby.                        |

Turkish strings use natural sentence order around `{{placeholders}}`, retain PIN
and established product names, and use Turkish plural forms only where the UI
needs distinct forms. The locale checker enforces key and placeholder parity.

### German (`de`)

| Concept                   | German                             | Usage                                                                                           |
| ------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------- |
| quiz                      | Quiz (pl. Quizze)                  | The authored content, distinct from the lobby and archived session.                             |
| my quizzes                | Meine Quizze                       | The quiz bank.                                                                                  |
| host                      | Quizleitung                        | The person presenting; gender-neutral, never “Host” or “Server”.                                |
| host seat                 | Leitungsplatz                      | The single-host lock in local mode.                                                             |
| participant               | Teilnehmende                       | The person answering, not “Spieler”.                                                            |
| nickname                  | Spitzname                          | The name chosen when joining.                                                                   |
| lobby                     | Raum                               | The lobby joined with a PIN: several quizzes in a row and the wait between them; one word only. |
| session                   | Sitzung                            | One completed quiz as shown in History.                                                         |
| console                   | Konsole                            | The host's control screen.                                                                      |
| projection                | Projektion                         | The shared screen seen in the lobby.                                                            |
| reveal                    | auflösen / Auflösung               | The action that shows correct answers.                                                          |
| leaderboard               | Rangliste                          | Live standings.                                                                                 |
| podium                    | Podium                             | Final standings.                                                                                |
| reviews                   | Bewertungen                        | Ratings and comments from participants.                                                         |
| history                   | Verlauf                            | Archived sessions and results.                                                                  |
| question / slide / option | Frage / Folie / Antwortmöglichkeit | Quiz content.                                                                                   |
| scoring / partial credit  | Wertung / Teilpunkte               | How points are awarded.                                                                         |
| leave / stop / close      | verlassen / stoppen / schließen    | A participant leaves the lobby; the host stops a quiz, closes the lobby.                        |

German uses the neutral infinitive style of German software (“Quiz starten”,
“Raum schließen”) and “Sie” where a direct address is unavoidable; never “du”.
Roles are gender-neutral (“Quizleitung”, “Teilnehmende”, “Administration”).
“Stoppen” is kept for stopping a quiz so “Abbrechen” stays the Cancel button,
and “beenden” is avoided (it reads like the normal end at the podium). Ordinals
are written `{{count}}.`, quotes are „…“. The locale is machine-assisted —
native review welcome.

### Hindi (`hi`)

| Concept                          | Hindi                           | Usage                                                                                           |
| -------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------- |
| quiz                             | क्विज़                          | The authored content, distinct from the lobby and archived session.                             |
| my quizzes                       | मेरे क्विज़                     | The quiz bank.                                                                                  |
| host                             | होस्ट                           | The person presenting; role name क्विज़ होस्ट.                                                  |
| host seat                        | होस्ट सीट                       | The single-host lock in local mode.                                                             |
| participant                      | प्रतिभागी                       | The person answering, also where en says “player”; never खिलाड़ी.                               |
| nickname                         | निकनेम                          | The name chosen when joining.                                                                   |
| lobby                            | रूम                             | The lobby joined with a PIN: several quizzes in a row and the wait between them; one word only. |
| session                          | सत्र                            | One completed quiz as shown in History.                                                         |
| console                          | कंसोल                           | The host's control screen.                                                                      |
| projection                       | प्रोजेक्शन                      | The shared screen seen in the lobby.                                                            |
| reveal                           | उत्तर दिखाएँ / उत्तर दिखाया गया | The action that shows correct answers, and its state.                                           |
| leaderboard                      | लीडरबोर्ड                       | Live standings; lobby standings are अंक तालिका.                                                 |
| podium                           | विजेता मंच                      | Final standings.                                                                                |
| reviews                          | समीक्षाएँ                       | Ratings and comments from participants.                                                         |
| history                          | इतिहास                          | Archived sessions and results.                                                                  |
| question / slide / answer choice | प्रश्न / स्लाइड / उत्तर विकल्प  | Quiz content; विकल्प for short.                                                                 |
| scoring / partial credit         | स्कोरिंग / आंशिक अंक            | How points are awarded; points are अंक.                                                         |
| leave / stop / close             | छोड़ें / रोकें / बंद करें       | A participant leaves the lobby; the host stops a quiz, closes the lobby.                        |

Hindi strings use everyday UI Hindi in Devanagari with the respectful आप form,
keeping software loanwords Hindi speakers actually use (क्विज़, रूम, स्लाइड,
मीडिया, सेव करें, साइन इन) over Sanskritised coinages; sentences end with ।.
Picture answers are तस्वीर, media images इमेज, sound files ऑडियो and sound
output आवाज़. Seconds are abbreviated से.; ordinals are numeric (1ला, 2रा, 4था,
5वाँ, 6ठा — Hindi has an ordinal `_many`, for the 6th); CSV file names stay in English. The locale is machine-assisted — native
review welcome.

### Italian (`it`)

| Concept                          | Italian                                                        | Usage                                                                                           |
| -------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| quiz                             | quiz                                                           | The authored content, distinct from the lobby and archived session; invariable plural.          |
| my quizzes                       | I miei quiz                                                    | The quiz bank (_raccolta_ in running text).                                                     |
| host                             | conduttore                                                     | The person presenting; role _Conduttore di quiz_.                                               |
| host seat                        | postazione del conduttore                                      | The single-host lock in local mode; _prendi / prolunga / libera_.                               |
| participant                      | partecipante                                                   | The person answering, never “giocatore”.                                                        |
| nickname                         | soprannome                                                     | The name chosen when joining.                                                                   |
| lobby                            | sala                                                           | The lobby joined with a PIN: several quizzes in a row and the wait between them; one word only. |
| session                          | sessione                                                       | One completed quiz as shown in History.                                                         |
| console                          | console                                                        | The host's control screen.                                                                      |
| projection                       | proiezione                                                     | The shared big screen.                                                                          |
| reveal                           | rivelare / rivelazione                                         | The moment answers are shown (_Rivela la risposta_).                                            |
| leaderboard                      | classifica                                                     | Live and lobby standings.                                                                       |
| podium                           | podio                                                          | Final standings.                                                                                |
| reviews                          | recensioni                                                     | Ratings and comments from participants.                                                         |
| history                          | Storico                                                        | Archived sessions and results.                                                                  |
| question / slide / answer choice | domanda / slide / scelta di risposta                           | Quiz content; _slide_ is invariable.                                                            |
| scoring / partial credit         | punteggio / punteggio parziale                                 | How points are awarded; _Tutto o niente_ otherwise.                                             |
| closest wins / tolerate typos    | vince la risposta più vicina / tollera gli errori di battitura | Numeric and text scoring rules.                                                                 |
| looking back / back to live      | sguardo indietro / torna alla diretta                          | Showing a played step again; nothing is replayed.                                               |
| leave / stop / close             | esci / interrompi / chiudi                                     | A participant leaves the lobby; the host stops a quiz, closes the lobby.                        |

Italian strings address the user with the informal _tu_, and use impersonal
forms or infinitives for labels. Quotes are «…», apostrophes typographic (’).
_Log out_ is _Disconnettiti_, so that _Esci_ stays the participant's leaving the
lobby. _Partita_ is used only where en says _game_ (the live game running, admin
statistics); the locale is machine-assisted — native review welcome.

### Japanese (`ja`)

| Concept                          | Japanese                        | Usage                                                                                           |
| -------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------- |
| quiz                             | クイズ                          | The authored content, distinct from the lobby and archived session.                             |
| my quizzes                       | マイクイズ                      | The quiz bank.                                                                                  |
| host                             | ホスト                          | The person presenting; クイズのホスト as a role name.                                           |
| host seat                        | ホスト席                        | The single-host lock in local mode; 確保 / 延長 / 解放 (claim / extend / release).              |
| participant                      | 参加者                          | The person answering, never プレイヤー.                                                         |
| nickname                         | ニックネーム                    | The name chosen when joining.                                                                   |
| lobby                            | ルーム                          | The lobby joined with a PIN: several quizzes in a row and the wait between them; one word only. |
| session                          | セッション                      | One completed quiz as shown in History.                                                         |
| console                          | コンソール                      | The host's control screen.                                                                      |
| projection                       | 投影画面                        | The shared big screen; 大画面 when participants refer to it.                                    |
| reveal                           | 正解発表 / 正解を発表           | The moment the answers are shown (state) and the console action.                                |
| leaderboard                      | ランキング                      | Live standings; 順位 for lobby standings and rank columns.                                      |
| podium                           | 表彰台                          | Final standings.                                                                                |
| reviews                          | レビュー                        | Ratings and comments from participants.                                                         |
| history                          | 履歴                            | Archived sessions and results.                                                                  |
| question / slide / answer choice | 問題 / スライド / 選択肢        | Quiz content; 第{{n}}問 for a numbered question.                                                |
| explanation                      | 解説                            | The note shown at the reveal.                                                                   |
| present                          | 出題                            | Launching a quiz live (Present, Publish to present).                                            |
| looking back / back to live      | 振り返り / ライブに戻る         | The host showing a played step again.                                                           |
| scoring / partial credit         | 採点方法 / 部分点               | How points are awarded; 全問正解のみ for all or nothing.                                        |
| closest wins / tolerate typos    | 最も近い答えが勝ち / 誤字を許容 | Numeric and typed-answer scoring.                                                               |
| leave / stop / close             | 退出 / 中止 / 閉じる            | A participant leaves the lobby; the host stops a quiz, closes the lobby.                        |

Japanese strings use polite です/ます sentences and short noun phrases for labels
and buttons, full-width punctuation (、。：「」（）) and no spaces between Japanese
text and `{{placeholders}}` except around Latin terms (PIN, file names). Counters
carry the sense of the plural (`{{count}}問`, `{{count}}人`, `{{count}}件`), and the
ordering positions read `{{count}}番目`. True / false is ○×, as Japanese quizzes
write it. The locale is machine-assisted — native review welcome.

### Polish (`pl`)

| Concept                          | Polish                                | Usage                                                                                           |
| -------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------- |
| quiz                             | quiz                                  | The authored content, distinct from the lobby and archived session.                             |
| my quizzes                       | Moje quizy                            | The quiz bank.                                                                                  |
| host                             | prowadzący                            | The person presenting; never “gospodarz” or “host”.                                             |
| host seat                        | miejsce prowadzącego                  | The single-host lock in local mode.                                                             |
| participant                      | uczestnik                             | The person answering, not “gracz”.                                                              |
| nickname                         | pseudonim                             | The name chosen when joining.                                                                   |
| lobby                            | pokój                                 | The lobby joined with a PIN: several quizzes in a row and the wait between them; one word only. |
| session                          | sesja                                 | One completed quiz as shown in History.                                                         |
| console                          | konsola                               | The host's control screen.                                                                      |
| projection                       | projekcja                             | The shared screen seen in the lobby.                                                            |
| reveal                           | odsłoń / odsłonięcie                  | The action that shows correct answers; never “korekta”.                                         |
| leaderboard                      | ranking                               | Live standings; lobby totals are “klasyfikacja pokoju”.                                         |
| podium                           | podium                                | Final standings.                                                                                |
| reviews                          | opinie                                | Ratings and comments from participants.                                                         |
| history                          | historia                              | Archived sessions and results.                                                                  |
| question / slide / answer choice | pytanie / slajd / wariant odpowiedzi  | Quiz content; “wariant” for short, never “opcja”.                                               |
| scoring / partial credit         | punktacja / punkty częściowe          | How points are awarded.                                                                         |
| looking back / back to live      | spojrzenie wstecz / wróć do bieżącego | Showing a played step again; nothing is replayed.                                               |
| leave / stop / close             | opuść (wyjdź) / zatrzymaj / zamknij   | A participant leaves the lobby; the host stops a quiz, closes the lobby.                        |

Labels and buttons use the imperative or infinitive (Zapisz, Anuluj), sentences
address the user with the informal “ty”; quotes are „…”. Every cardinal plural
has the four i18next forms `_one` / `_few` / `_many` / `_other` (1 pytanie,
2 pytania, 5 pytań, 1,5 pytania); ordinals are written `{{count}}.`. Media are
counted as “materiał” (1 materiał, 5 materiałów), the uncountable “multimedia”
names the kind. The locale is machine-assisted — native review welcome.

### Russian (`ru`)

| Concept                          | Russian                                        | Usage                                                                                           |
| -------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| quiz                             | квиз                                           | The authored content, distinct from the lobby and archived session.                             |
| my quizzes                       | Мои квизы                                      | The quiz bank.                                                                                  |
| host                             | ведущий                                        | The person presenting; never the server (сервер, хост).                                         |
| host seat                        | место ведущего                                 | The single-host lock in local mode; занять / продлить / освободить.                             |
| participant                      | участник                                       | The person answering, not “игрок”.                                                              |
| nickname                         | псевдоним                                      | The name chosen when joining.                                                                   |
| lobby                            | комната                                        | The lobby joined with a PIN: several quizzes in a row and the wait between them; one word only. |
| session                          | сессия                                         | One completed quiz as shown in History.                                                         |
| console                          | пульт                                          | The host's control screen; never “панель управления”.                                           |
| projection                       | проекция                                       | The shared screen seen in the lobby.                                                            |
| reveal                           | показать ответ / показ ответа                  | The action (console) and the state that shows correct answers.                                  |
| leaderboard                      | таблица лидеров                                | Live standings; lobby standings are “рейтинг комнаты”.                                          |
| podium                           | пьедестал                                      | Final standings.                                                                                |
| reviews                          | отзывы                                         | Ratings and comments from participants.                                                         |
| history                          | история                                        | Archived sessions and results.                                                                  |
| question / slide / answer choice | вопрос / слайд / вариант ответа                | Quiz content.                                                                                   |
| scoring / partial credit         | начисление баллов / частичные баллы            | How points are awarded.                                                                         |
| tolerate typos / closest wins    | допускать опечатки / побеждает ближайший ответ | Scoring rules of text and number questions.                                                     |
| looking back / back to live      | повторный просмотр / вернуться к текущему      | Showing a played step again; nothing is replayed.                                               |
| leave / stop / close             | выйти / остановить / закрыть                   | A participant leaves the lobby; the host stops a quiz, closes the lobby.                        |

Russian uses the four i18next cardinal forms (`_one`, `_few`, `_many`, `_other`),
always with `{{count}}` since `_one` also covers 21, 31…; `_other` is the
fractional form (1,5 вопроса). Ordinals are `{{count}}-е`. _Квиз_ is kept as a
loanword (as in fr/es) rather than _викторина_; _медиафайл_ for media, _инстанс_
for instance; «…» quotes and polite lowercase “вы”. The locale is
machine-assisted — native review welcome.

- **quiz, not questionnaire.** Product name and common usage; "questionnaire"
  reads like a survey. Kept as `quiz` in every locale (it is a loanword in
  fr/es); Chinese uses 测验/測驗 (a test one plays), not 问卷 (a survey).
- **lobby, quiz, session**: three levels since the multi-quiz lobby (#89).
  - **lobby** (fr _salon_): what participants join with the PIN and stay in,
    the wait between quizzes included — joining, sharing, locking, leaving,
    being removed, closing (_Close the lobby_, never _End the session_). One
    word per locale, never two: en never says _room_ for it, fr never _salle
    d’attente_; `room` stays in code identifiers, routes and the technical
    specifications. Being physically there is _on site_ (fr _dans la salle_),
    never the lobby’s word;
  - **quiz**: the one being played in it — starting, pace, pause, who hears
    the sound, archiving its results (_Start the quiz_, _Quiz paused_);
  - **session**: afterwards only — one quiz played, as _History_ archives it.

  Never _partie_ / _game_ in the interface; `session` stays in code
  identifiers and routes.

- **audio, effect, sound**: never _sound_ for a medium in en.
  - **audio** (fr _audio_): a recorded medium beside image and video — _Add
    audio_, _My audio_, _Who hears the audio_; countable as _an audio file_ in
    en, _un audio_ / _des audios_ in fr. Also the device's output in en
    (_Turn audio on_, _Without audio_); fr keeps _le son_ there (_Activer le
    son_, _Sans le son_), the idiom of every interface.
  - **effect** (fr _effet_): the game's short sounds — tick, ding, gong,
    countdown — set per lobby or per theme; never _sound_ / _son_.
  - Other locales follow the sense, not the en word: one word for the medium,
    one for the effects, the device's output in the locale's idiom — de
    _Audio_ / _Effekt_ / _Ton_; es _audio_ / _efecto_ / _sonido_; it _audio_ /
    _effetto_ / _audio_; pl _nagranie_ (_plik audio_) / _efekt_ / _dźwięk_; ru
    _аудио_ / _эффект_ / _звук_; tr _ses_ / _efekt_ / _ses_; hi _ऑडियो_ /
    _इफ़ेक्ट_ / _आवाज़_; ja _音声_ / _効果音_ / _音声_; zh _音频_ / _音效_ /
    _声音_; zh-TW _音訊_ / _音效_ / _聲音_.

- **leave, stop, close**: one verb per thing ended, never swapped.
  - **leave** (fr _quitter_): a participant going out of the lobby (_Leave the
    lobby?_); never said of the host or of a quiz;
  - **stop** (fr _arrêter_): the host giving up the quiz in progress, the lobby
    staying open (_Stop the quiz…_); never _end_ / _terminer_, which reads like
    the normal end at the podium;
  - **close** (fr _fermer_): the lobby — ending it (_Close the lobby_) or shutting
    it to newcomers (_Close the lobby to new participants_).

- **host / animateur**: the person presenting. fr uses _animateur_
  (presenter/facilitator) — _hôte_ is kept only in _siège hôte_, where the
  seat is a technical lock, not a person.
- **participant, not player**: the people answering may be students or
  colleagues; _player_ only survives in code identifiers and route ids.
- **slide**: kept in French (common in presentation software); es
  _diapositiva_; zh-TW _簡報_ (noeFly's choice, #16), zh _幻灯片_.
- **console / projection**: the two host screens. _Console_ is the control
  surface (never _dashboard_, which is _My quizzes_); _projection_ is the big
  screen (never _display_ or _screen_, too generic).
- **reveal**: the moment answers are shown; a verb in the console (_Reveal
  now_) and a state everywhere else. fr _révéler / révélation_, never
  _correction_.
- **answer choice, not option**: what the author writes for a participant to pick
  (fr _choix de réponse_, a _choix_ for short); _option_ only survives in code. Not
  _answers_ either: those are what participants send (_Answers received_).
- **answer shown for**: in auto mode, how long the right answer stays on screen
  before moving on (fr _affichage de la réponse_); never _reveal delay_, which reads
  like a wait before the reveal.
- **explanation**: the note shown at the reveal; not _solution_ (there may be
  none, e.g. a poll) nor _feedback_ (reserved for reviews).
- **reviews** (participants rating a quiz) vs **feedback** (the API/DB word):
  the interface says _reviews / avis_; `feedback` stays in identifiers only.
- **history** for archived sessions of a quiz (not _sessions_, which is the
  live word).
- **looking back / back to live**: the host showing a played step again;
  nothing is replayed, so no _replay_ / _rejouer_ wording anywhere.
- **scoring / barème**: the per-question rule. _Points_ (standard / double /
  fixed) is the amount; _scoring_ is how the answer earns it.
- **closest wins**: ranks numeric answers by distance; say _closest_, never
  _nearest guess_ (there is a right value).
- **partial credit** (multiple choice, ordering) vs **all or nothing**: the
  default is all or nothing, and its wording stays explicit in the rules line.
- **tolerate typos / lenient**: _lenient_ is the code value; the interface
  always explains it (_tolerate typos_), never says _fuzzy_.
- **host seat**: the single-host lock of local mode; _claim_, _extend_,
  _release_ are its verbs (never _login_ for the seat itself).
- **Taiwan usage in zh-TW**: 資料 (data), 檔案 (file), 清單 (list), 拖曳
  (drag), 送出 (submit), 儲存 (save), 自訂 (custom), 置中 (centre), 連線
  (connect — 連接 only in 連接埠, port), 簡報 (slide), 匿稱 (nickname), 回饋
  (feedback), 登出 (log out), 是非題 / 單選題 / 多選題 / 排序題 / 投票題 /
  圖片選擇 (question types), 畫面 for an app screen vs 螢幕 for the physical one,
  「」 quotes, 破折號 ——. zh-TW is resolved straight to `en`, never through
  `zh`. The locale was contributed and reviewed by [@noeFly](https://github.com/noeFly) (#1, #16); later keys
  are machine-assisted and follow their choices — native review welcome.
- **No jargon leaks**: tokenised error codes (`quiz.not_found`…) are
  translated in `errors.json`; the interface never shows a code.
