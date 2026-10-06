---
version: alpha
name: EXC Kinetic Film
description: 엑스퍼트컨설팅 90초 키네틱 모션그래픽의 시각 체계. index.html이 이 파일의 colors를 읽어 렌더한다.
colors:
  paper: "#F2EEE5"
  ink: "#15171C"
  signal: "#009A5A"
  alert: "#E0412B"
  cobalt: "#2347C6"
  ochre: "#EDB01F"
  graphite: "#6B6E75"
  rule: "#CFC8BA"
typography:
  brand-display:
    fontFamily: Pretendard Variable
    fontSize: 190px
    fontWeight: 900
    lineHeight: 1
    letterSpacing: 0em
  headline-xl:
    fontFamily: Pretendard Variable
    fontSize: 156px
    fontWeight: 900
    lineHeight: 1.05
    letterSpacing: 0em
  headline-lg:
    fontFamily: Pretendard Variable
    fontSize: 104px
    fontWeight: 860
    lineHeight: 1.15
    letterSpacing: 0em
  body-lg:
    fontFamily: Pretendard Variable
    fontSize: 64px
    fontWeight: 420
    lineHeight: 1.3
    letterSpacing: 0em
  label-caps:
    fontFamily: Pretendard Variable
    fontSize: 24px
    fontWeight: 650
    lineHeight: 1
    letterSpacing: 0.34em
  numeral-roll:
    fontFamily: Pretendard Variable
    fontSize: 320px
    fontWeight: 820
    lineHeight: 0.95
    letterSpacing: 0em
rounded:
  none: 0px
  full: 9999px
spacing:
  frame-width: 1920px
  frame-height: 1080px
  margin: 140px
  gutter: 48px
  vertical-frame-width: 1080px
  vertical-frame-height: 1920px
  vertical-safe-top: 270px
  vertical-safe-bottom: 670px
  vertical-safe-side: 90px
components:
  keyword-pill:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    padding: 18px
    height: 48px
  station-node:
    backgroundColor: "{colors.signal}"
    size: 48px
    rounded: "{rounded.full}"
  brand-period:
    backgroundColor: "{colors.signal}"
    size: 40px
    rounded: "{rounded.full}"
  brand-card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.brand-display}"
  brand-logo:
    width: 330px
---

# EXC Kinetic Film

## Overview

칼더의 모빌과 진자 같은 **키네틱 아트**를 화면 언어로 쓴다. 원·선·호·막대 같은 기본 도형이 물리적으로 흔들리고, 맞물리고, 균형을 찾는다. 글자도 같은 법칙을 따른다. 굵기(가변 폰트 wght)가 움직이고, 글자가 떨어지고, 튕기고, 한 점으로 빨려 든다.

이야기는 하나의 은유로 묶는다. 처음에 흔들리던 초록 진자(불확실한 질문)는 마지막에 멈춰서 **"엑스퍼트컨설팅."의 마침표**가 된다. 흩어진 교육 키워드는 하나의 선으로 꿰이고, 선은 고리(채용→성장의 Total HR 흐름)가 되며, 고리의 공은 모빌의 고리로 이어진다.

## Colors

인쇄물 같은 따뜻한 종이 바탕에 잉크를 쓴다. 강조색은 로고의 초록 하나로 두고, 파랑·노랑은 칼더풍 조형의 보조색으로 쓴다.

- **paper (#F2EEE5):** 기본 바탕. 화면에 고정된 종이 질감을 얹는다.
- **ink (#15171C):** 본문과 선. 혼돈·증명 장면에서는 바탕으로 반전한다.
- **signal (#009A5A):** 유일한 강조색이자 로고의 초록. 진자, 진행 호, 강조어("그대로", "설계", "흐름", "균형"), 마지막 마침표에만 쓴다.
- **alert (#E0412B):** C안(`accent=split`) 전용 문제 구간 강조색. 0–21초의 진자, 혼돈 장면의 조각과 강조어("그대로"), 끊어지는 선에만 쓴다. 21초의 선부터는 signal로 넘어간다. 기본 렌더에서는 쓰지 않는다.
- **cobalt (#2347C6) / ochre (#EDB01F):** 키네틱 조형의 보조 색. 텍스트 강조에는 쓰지 않는다.
- **graphite (#6B6E75):** 보조 문장, 라벨.
- **rule (#CFC8BA):** 궤적 가이드 같은 가는 선.

> 확인 필요: signal(#009A5A)은 사용자가 준 로고 PNG(374×82)에서 잰 픽셀값이다. 같은 로고의 검정은 #231815로, ink(#15171C)와 거의 같아 ink는 바꾸지 않았다. 공식 CI 색상표와 대조가 필요하다. 값을 바꾸려면 이 파일의 `colors`만 고치고 다시 렌더하면 된다.

## Typography

한 가족(Pretendard Variable, 45–920)만 쓰고 굵기 축을 움직임의 재료로 쓴다. 글자는 가늘게(90–250) 시작해 목표 굵기로 굳으며 등장한다.

- **brand-display:** 마지막 "엑스퍼트컨설팅" 한 곳에만 쓴다.
- **headline-xl / headline-lg:** 장면별 핵심 문장.
- **body-lg:** 질문과 보조 문장. graphite 색과 짝을 이룬다.
- **label-caps:** "TOTAL HR FLOW", "SINCE", "EVERY YEAR" 같은 영문 라벨.
- **numeral-roll:** 1994→2026, 0→1,000+ 오도미터 숫자.

## Layout

1920×1080, 30fps, 120BPM(한 박 0.5초). 모든 장면 전환과 텍스트 등장은 0.5초 격자에 맞춘다. 좌우 여백 140px. 텍스트와 조형은 좌우로 나눠 배치하고(왼쪽 문장, 오른쪽 진자·모빌 / 왼쪽 고리, 오른쪽 설명), 마지막 카드만 중앙 정렬한다.

**9:16 숏폼판(1080×1920):** 같은 장면을 위아래로 쌓는다(위 진자·고리 / 아래 문장, 위 문장 / 아래 모빌). 글자와 로고는 쇼츠·릴스·틱톡 UI가 덮지 않는 영역(가로 90–990px, 세로 270–1250px) 안에 둔다. 아래쪽 670px와 오른쪽 버튼 줄에는 조형만 둔다. 긴 문장은 두 줄로 나누고, 정렬 장면의 키워드는 6개만 선에 꿴다. 워드마크는 130px 한 줄로 줄인다.

## Shapes

원(진자 추, 스테이션, 모빌 원판, 마침표), 1.5–7px 선(줄, 막대, 고리), 완전히 둥근 알약(키워드)만 쓴다. 각진 카드나 그림자는 쓰지 않는다.

## Components

- **keyword-pill:** 교육 키워드. 혼돈 장면에서는 색·외곽선·회전이 제각각이고, 정렬 장면에서 paper 바탕·ink 외곽선으로 통일되며 선 위에 꿰인다.
- **station-node:** Total HR 고리 위 6개 정류장(채용, 진단·평가, HRD 컨설팅, 집합교육, 이러닝, 연수원). 공이 도착하면 색이 채워진다.
- **brand-period:** 진자의 추이자 마지막 마침표. 영상 전체에서 같은 초록 점이다.
- **brand-logo:** 엔딩 카드의 구분선 아래에 폭 330px로 두는 실제 로고. 사용자가 준 파일(`brand/logo.svg` 또는 `brand/logo.png`)을 색과 비율 그대로 쓴다. 이 파일은 레포에 넣지 않으며, 없으면 "TOTAL HR PROFESSIONAL · SINCE 1994" 태그라인을 쓴다.

## Motion

- 공간 이동에는 선형 이징을 쓰지 않는다. 등장은 outExpo/outBack, 퇴장은 inCubic/inExpo.
- 흔들림은 감쇠 진동(진자, 모빌)으로 표현하고, 메시지가 "균형"이나 "답"에 닿을 때 정지한다.
- 멈춤도 움직임이다. 20–21초는 화면과 소리를 모두 멈춘다.

## Do's and Don'ts

- Do: signal은 한 화면에 한 가지 의미에만 쓴다. C안에서도 강조색은 한 화면에 하나다. 21초의 선이 그어지는 1초 남짓만 흩어지는 alert 조각과 겹친다.
- Do: 숫자와 사실은 확인된 것만 쓴다(1994년 설립, 연간 1,000여 기관).
- Don't: 로고를 다시 그리거나 고치지 않는다(색, 비율, 마침표 추가). 크게 쓰는 브랜드 표기는 타이포그래피 워드마크로 하고, 로고는 받은 파일 그대로 작게 쓴다.
- Don't: 네온·그라디언트 텍스트·글로우를 쓰지 않는다.
