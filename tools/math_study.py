#!/usr/bin/env python3
import json, re, random, sys
from pathlib import Path

DATA_PATH = Path(__file__).parent.parent / 'subjects.json'

with open(DATA_PATH, 'r', encoding='utf-8') as f:
    subjects = json.load(f)

def gen_wrong_options(ans: str, count=3) -> list:
    ans = ans.strip()
    wrongs = set()
    frac = re.match(r'^(-?\d+)/(\d+)$', ans.replace('−','-'))
    if frac:
        a, b = int(frac.group(1)), int(frac.group(2))
        wrongs.update([f"{b}/{abs(a)}" if a else f"1/{b}", f"{-a}/{b}",
                       f"{a}/{b+1}", f"{a+1}/{b}", str(a), str(b)])
    else:
        try:
            val = float(ans.replace('−','-'))
            iv = int(round(val))
            wrongs.update([str(-round(val,4)) if val else "1",
                           str(iv+1), str(iv-1), str(iv+2), "0"])
            if val: wrongs.add(str(round(1/val,4)))
        except:
            wrongs.update(["0","∞","-"+ans if not ans.startswith('-') else ans[1:]])
    wrongs.discard(ans)
    w = list(wrongs)
    for fb in ["0","1","-1","∞","2","-2","1/2"]:
        if fb != ans and fb not in w and len(w) < count:
            w.append(fb)
    return w[:count]

def make_options(correct: str) -> list:
    opts = [correct] + gen_wrong_options(correct, 3)
    random.shuffle(opts)
    return opts

def study_sheet(key, limit=None):
    qs = subjects.get(key,{}).get('questions',[])
    if limit: qs = qs[:limit]
    print(f"\n{'='*55}")
    print(f"  {key}  |  Jami: {len(subjects[key]['questions'])} savol")
    print('='*55)
    for i,q in enumerate(qs,1):
        print(f"\n{i}. {q['q']}")
        opts = q.get('options') or make_options(str(q['a']))
        for lbl,opt in zip(['A','B','C','D'], opts):
            mark = "✅" if str(opt)==str(q['a']) else "  "
            print(f"  {mark} {lbl}) {opt}")

if __name__ == '__main__':
    if len(sys.argv) >= 4 and sys.argv[1] == 'gen':
        # python3 math_study.py gen "Savol matni" "to'g'ri javob"
        q,a = sys.argv[2], sys.argv[3]
        result = {"q": q, "a": a, "options": make_options(a), "hint": ""}
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
<<<<<<< HEAD
        study_sheet('dasturiy_injiniring_math', limit=20)
=======
        study_sheet('dasturiy_injiniring_math', limit=20)
>>>>>>> bc37f51 (Yangilanish)
