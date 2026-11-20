'use strict';

/* ============================================================
   Домашнее задание «Современный Асинхронный JavaScript»
   Задание: создать функцию race(), которая принимает массив
   Promise и возвращает первый успешно выполненный ИЛИ отклонённый.
   ============================================================ */

// ---------- DOM ----------
const startBtn = document.getElementById('start-btn');
const spinner = document.getElementById('spinner');
const resultBox = document.getElementById('result');
const errorBox = document.getElementById('error');
const logBox = document.getElementById('log');
const logList = document.getElementById('log-list');
const winnerText = document.getElementById('winner-text');
const raceTime = document.getElementById('race-time');
const raceTimeErr = document.getElementById('race-time-err');
const nativeCheckOk = document.getElementById('native-check-ok');
const nativeCheckErr = document.getElementById('native-check-err');
const errorText = document.getElementById('error-text');

/* ------------------------------------------------------------
   РЕШЕНИЕ: собственная реализация race()
   ------------------------------------------------------------ */
function race(promises) {
  return new Promise((resolve, reject) => {
    for (const item of promises) {
      // Promise.resolve оборачивает даже не-промис (такой станет
      // fulfilled мгновенно и победит) — как в нативном race.
      // Передаём ВНЕШНИЕ resolve/reject обработчиками:
      // кто из участников первым settle-нется, тот и settle-ит
      // внешний промис. Повторные вызовы игнорируются:
      // промис завершается только ОДИН раз (идемпотентность).
      Promise.resolve(item).then(resolve, reject);
    }
  });
}

// ---------- Мок-участники гонки ----------

// Случайная задержка в диапазоне [min, max]
function randomDelay(min, max) {
  return Math.round(min + Math.random() * (max - min));
}

// «Сервер»: отвечает через delay мс; при shouldFail — «падает» (reject)
function createRunner(id, delay, shouldFail) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (shouldFail) {
        reject(new Error(`Участник ${id} упал с ошибкой`));
      } else {
        resolve(`Участник ${id} ответил успешно`);
      }
    }, delay);
  });
}

// Три участника со случайными задержками; у каждого 25% шанс «упасть»
function createContestants() {
  return [1, 2, 3].map((id) => ({
    id,
    delay: randomDelay(300, 2000),
    shouldFail: Math.random() < 0.25,
  }));
}

// ---------- UI-хелперы ----------

function resetUI() {
  resultBox.classList.add('hidden');
  errorBox.classList.add('hidden');
  logBox.classList.add('hidden');
  logList.innerHTML = '';
}

function addLog(message) {
  const li = document.createElement('li');
  li.textContent = message;
  logList.appendChild(li);
}

// ---------- Основной сценарий ----------

async function runRace() {
  resetUI();
  spinner.classList.remove('hidden');
  const start = Date.now();

  const contestants = createContestants();
  addLog(
    'Участники: ' +
      contestants
        .map(
          (c) => `#${c.id} — ${c.delay} мс${c.shouldFail ? ' (упадёт)' : ''}`,
        )
        .join(', '),
  );

  const promises = contestants.map((c) => {
    const p = createRunner(c.id, c.delay, c.shouldFail);
    // Побочный журнал каждого финиша; на результат гонки не влияет
    p.then(
      () => addLog(`✅ #${c.id} финишировал на ${Date.now() - start} мс`),
      () => addLog(`❌ #${c.id} финишировал на ${Date.now() - start} мс`),
    );
    return p;
  });

  // Запускаем МОЮ гонку и НАТИВНУЮ на одних и тех же участниках:
  // подписываться на промис несколько раз — законно
  const [mine, native] = await Promise.allSettled([
    race(promises),
    Promise.race(promises),
  ]);

  const time = Date.now() - start;
  spinner.classList.add('hidden');
  logBox.classList.remove('hidden');

  // Сверка: статус и value/reason должны совпасть
  const same =
    mine.status === native.status &&
    (mine.status === 'fulfilled'
      ? mine.value === native.value
      : mine.reason === native.reason);
  const checkText = same ? '✅ совпало' : '❌ разошлось';

  if (mine.status === 'fulfilled') {
    winnerText.textContent = mine.value;
    raceTime.textContent = time;
    nativeCheckOk.textContent = checkText;
    resultBox.classList.remove('hidden');
  } else {
    errorText.textContent =
      '🏁 Первым финишировал отказ: ' + mine.reason.message;
    raceTimeErr.textContent = time;
    nativeCheckErr.textContent = checkText;
    errorBox.classList.remove('hidden');
  }
}

startBtn.addEventListener('click', runRace);

/* ------------------------------------------------------------
   Самотесты в консоли (выполняются один раз при загрузке)
   ------------------------------------------------------------ */
async function selfTest() {
  const t1 = await race([
    new Promise((r) => setTimeout(() => r('медленный'), 200)),
    new Promise((r) => setTimeout(() => r('быстрый'), 50)),
  ]);
  console.log('Тест 1 — первый fulfilled:', t1); // "быстрый"

  try {
    await race([
      new Promise((r) => setTimeout(() => r('медленный'), 200)),
      new Promise((_, j) =>
        setTimeout(() => j(new Error('быстрый отказ')), 50),
      ),
    ]);
  } catch (e) {
    console.log('Тест 2 — первый rejected:', e.message); // "быстрый отказ"
  }

  const t3 = await race([
    new Promise((r) => setTimeout(() => r('поздний'), 100)),
    42,
  ]);
  console.log('Тест 3 — не-промис побеждает мгновенно:', t3); // 42
}

selfTest();
