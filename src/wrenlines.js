// Everything Wren says (from the two plans): by topic, each line with the trust level it needs
// (0 Strained, 1 Guarded, 2 Okay, 3 Close, 4 Family). `before` is how she talks until the third cook;
// `after` is the new voice (she calls you Chef). Kit lines keep the quiet voice either way.
const L = (lv, t) => [lv, t];

export const LEVELS = [['Strained', 0, '#ff6a5a'], ['Guarded', 15, '#ffd166'], ['Okay', 35, '#c8e6a0'], ['Close', 55, '#7be08a'], ['Family', 80, '#5fd0ff']];

export const TOPICS = [['holding', 'How are you holding up?'], ['kit', 'Kit'], ['vic', 'Vic'], ['business', 'The business'], ['pratt', 'Pratt'], ['chat', 'Just chat']];
export const ASK = { holding: 'You okay?', kit: 'Tell me about Kit.', vic: 'Heard from Vic?', business: "How's it going out there?", pratt: 'Has Pratt called?', chat: 'So…' };
export const TOPIC_MIN = { kit: 2 }; // (Kit: not until she trusts you a bit)

const KIT = [
  L(2, 'He used to sleep in that van when he and Vic weren\'t talking. Which was most weeks.'),
  L(2, 'He tried to learn guitar off Dez for a month. He learned one song. Badly. On purpose, I think.'),
  L(2, 'When Mum got sick he did all the cooking. Burnt everything. We ate it anyway.'),
  L(3, "He called me every Sunday. Every one. I didn't always pick up."),
  L(3, 'He was the one who stayed. Vic left, I left, Kit stayed with Mum till the end.'),
  L(3, "He wanted to open a food truck. In the van. He had a name and everything: Kit's Kitchen. It was a terrible name."),
  L(4, "I keep thinking if I'd answered at three, not at four, something would be different."),
  L(4, "Thank you for being his friend. He talked about you more than you'd think."),
];

export const BEFORE = {
  holding: [
    L(1, "I'm fine."), L(1, "Don't. I'm holding it together with tape."),
    L(2, 'I keep making two coffees in the morning. Kit never even drank coffee.'), L(2, "Some hours are fine. Then I see a green hoodie and I'm not."),
    L(3, "Honestly? Better when you're around. Don't make it weird."), L(3, 'I slept through the night. First time. I felt guilty about it.'),
    L(4, "I think I'm going to be okay. Not soon. But I think so."),
  ],
  kit: KIT,
  vic: [
    L(1, 'No. And yes. A thumbs up. To a funeral.'), L(2, 'He posted a photo of his car. With a filter. Today.'), L(2, "He's not a bad person. He's just always been somewhere else."),
    L(3, 'He paid for everything when we were kids. Mum\'s rent. My school shoes. Then he stopped and never said why.'), L(3, "He called me 'Wrenny' at the hospital. He hasn't called me that since I was nine."),
    L(4, "If he finds out about this, he won't shout. That's worse. He'll just be disappointed, and right."),
  ],
  business: [
    L(1, "It's going. They pay. I don't ask what they do with it."), L(2, "Kit's buyers think I'm his cousin. I didn't correct them."), L(2, "One guy asked if the new stuff was Kit's. I said it was better. He said 'I know.'"),
    L(3, "I've got a system now. Notebook, codes, the lot. Kit would've laughed at me."), L(3, "Your last batch was the cleanest they'd seen. You should be proud. You shouldn't, but you should."),
    L(4, 'Sometimes I forget why we\'re doing this. Then I open the hospital letter.'),
  ],
  pratt: [
    L(1, "Twice. I didn't answer. He left a voicemail that just said my name."), L(2, "He sent flowers. To the funeral. With a card that said 'Talk soon.'"),
    L(3, "He knows where I live now. Where we live. I don't know how."), L(3, "Kit owed him more than money. I don't know what that means yet."),
    L(4, "Whatever happens with Pratt, it doesn't touch you. Promise me you'll let me handle it."),
  ],
  chat: [
    L(0, "Mrs. Okafor corrected my grammar today. In a text. She's eighty."), L(0, "June asked if we're dating. I said yes, just to see her face."), L(0, 'Dez played something sad through the wall last night. It was actually good.'),
    L(0, 'Have you ever just driven to the end of the island and back? Kit did that when he couldn\'t sleep.'), L(0, "If you could live anywhere else, where? I'd pick somewhere with snow. Never seen snow."),
    L(3, 'You snore, by the way. Not loud. Just constantly.'),
  ],
};

export const AFTER = {
  holding: [
    L(1, "I'm good. I'm great. I'm extremely fine, Chef."), L(2, "Buzzing. Couldn't sleep, so I reorganised the whole notebook. By colour."),
    L(3, "Honestly? I'm good at this. I've never been good at anything. That's messed up, right?"),
    L(4, "Some nights I'm on top of the world and then I remember why we started. Both. At once."),
  ],
  holdingWrecked: [L(0, '…Not today. Ask me tomorrow.'), L(0, "Not today, Chef. Sorry.")],
  kit: KIT.concat([
    L(2, "He'd have been so bad at this. He'd have given it away to his mates."), L(3, "I found his old playlist. It's all songs about vans. Every one. He had a theme."),
    L(3, "People keep saying 'Kit's stuff.' It's not his. It's ours. I don't know why that makes me so angry."), L(4, "Sometimes I'm having fun and I feel like I'm cheating on him."),
  ]),
  vic: [
    L(1, 'Vic who? Never heard of him.'), L(1, "He's our cousin. He acts like our dad. He's neither, most weeks."), L(2, "Vic asked if I'm 'okay for money.' I said I'm thriving, Vic. Thriving."),
    L(3, "He saw my new shoes. Did the face. The disappointed-dad face. He's not my dad, Chef."), L(4, "If he finds out, I want it to be from me. I want to see his face. Is that bad?"),
  ],
  business: [
    L(1, "It's moving, Chef. It is MOVING."), L(2, "My people call it the blue. Some call it Meridian. I didn't tell them that. Somebody did."), L(2, 'A guy offered me his car for ten bags. I said no. It was a good car though.'),
    L(3, "I've got a waiting list. A WAITING LIST, Chef."), L(4, "We're not dealers. We're a small business. With a very specific customer base."),
  ],
  pratt: [
    L(1, 'Pratt called. I let it ring out. It felt amazing.'), L(2, "His guy was outside the building again. I waved. He didn't wave back. Rude."),
    L(3, "I'm not scared of him. I'm a bit scared of him. I'm mostly angry."), L(4, "When we pay him off, I'm gonna hand it to him myself. In small change."),
  ],
  chat: [
    L(0, "Do you think the guy on Channel 6 knows it's us? He looks at the camera like he knows."), L(0, "I named the van's stove. Gertrude. Don't ask."),
    L(0, "June asked what I do now. I said 'consulting.' She said 'for who.' I left."), L(0, "If we ever get rich-rich, I'm buying the pier. The whole pier."),
    L(3, 'Chef, real talk: you need a hobby. A not-this hobby.'),
  ],
};

export const HANG = [
  'You get chips by the pier. Wren steals all the crispy ones and denies it.',
  'You sit on the beach until the sun goes. Neither of you says much. It\'s fine.',
  'You drive to the end of the island and back, the way Kit used to. She picks the music.',
  'You play cards on the floor of 1E. She cheats. Badly.',
  "You watch Channel 6 with the sound off and make up what the newsreader's saying.",
];

export const SMALL = {
  thanks: ["Don't. Just keep cooking it clean.", 'Anytime. Well. Most times.'],
  thanksAfter: ['Anytime, Chef.', "Don't get soppy on me, Chef."],
  sorry: ["…Okay. Don't do it again.", 'I know you are. Give me a bit.'],
  sorryClose: ['I know. Come here.'],
  snap: ['Wow. Okay.', 'Kit never talked to me like that.', 'Say that again and you can sell it yourself.'],
  hello: ['Hey.', 'Oh. Hi.', 'Hey, you.'], helloAfter: ['Yo, Chef.', 'Chef! There he is.', "What's cooking, Chef? Ha. Get it."],
  bye: ['Okay. Bye.', "Don't do anything stupid."], byeAfter: ['Later, Chef.', "Don't blow up."], byeClose: ['Go home. Sleep. You look like a raccoon.'],
  take: ['Leave it with me.', 'Got it.'], takeAfter: ['Ohh, come to mama. My people are gonna lose their minds.', "Yeah, Chef! Blue magic!", 'Look at that. LOOK at it.'],
  fetch: ['Hand them over. Quick.', 'Got it. Go home, you look awful.'], fetchClose: ['Nice. Same time tomorrow?'],
  bring: ['You came yourself. Thanks.', "Good timing, I'm out."], bringClose: ["Sit for a minute. I'm not ready to go back out yet."],
};

// what she says when you do things near her: [before, after]
export const REACT = {
  punch: [['What are you doing?', "Leave it! Let's go.", 'Was that necessary?'], ['Whoa whoa whoa, Chef! Use your words!', 'Leave it, Chef! Come ON.']],
  gun: [['Put that away. Now.', 'Are you insane? People are watching!', 'Kit never carried. Ever.'], ['Put it AWAY, man, are you crazy?', "Chef! Not here! Not ANYWHERE!"]],
  kill: [['…No. No, no, no.', "That's someone's brother."], ['…No. Chef. No.', "That's someone's brother, Chef."]],
  steal: [["This isn't your car.", "Great. Now we're car thieves too."], ["Chef, that's somebody's car!", 'Oh, cool, grand theft. Love that for us.']],
  aim: [['Point that somewhere else.', 'Seriously?'], ['Yo! Point that somewhere else!', 'Chef. CHEF. Not at me.']],
  bumped: [['Ow! Watch it.', "I'm fine. I'm fine."], ['Ow! Chef!', 'Watch it, man!']],
  hurt: [['What is WRONG with you?', "Don't you ever do that again."], ["Chef, what the hell?!", "Don't you EVER do that again."]],
  reported: [['Someone saw. We need to go.', "Keep your head down. Walk, don't run."], ['Somebody saw, Chef. Move.', 'Act normal. ACT NORMAL.']],
  chase: [['Drive. DRIVE.', 'Left! No, your other left!', "I can't go to prison, I have a funeral to pay for."], ['Go go go GO!', "I'm too pretty for prison, Chef!", 'Left! LEFT!']],
  lost: [['…Okay. Okay. Breathe.', 'Never again. Until next time, probably.'], ['Yeah, Chef! …Okay, no, that was terrifying. Never again.', "We're alive. We're ALIVE."]],
  friskClean: [["Smile. You're boring. You're so boring."], ['Look how boring you are. Beautiful.']],
  friskFound: [['You had that ON you?'], ['Dude. DUDE. You had that ON you?']],
  fast: [['Slow down. Please.', "I'd like to get there alive."], ["Yo, Chef, I'd like to see twenty-five, okay? TWENTY-FIVE.", 'Slow DOWN, man!']],
  fastClose: [['Kit drove worse. Barely.'], ['Kit drove worse. Barely. Still too fast, Chef.']],
  crash: [['Is everyone… is everything okay?', 'My neck. Thanks for that.'], ['OW. Chef! My NECK!', 'Is the car okay? Are WE okay?']],
  hospital: [['Can we not go this way?'], ['Can we… not go this way, Chef.']],
  cookIn: [["I'll be out here.", "Shout if it goes wrong. Or don't, I'll hear the bang."], ["I'll be out here, Chef. Make it sing.", "Gertrude's all yours."]],
  clean: [["That's… that's really blue.", "They're going to love that."], ['Yeah, Chef! Blue magic!', "Ohhh, that's GLASS. That's art."]],
  cloudy: [['That looks like his.'], ['Chef. What is this. This is beige.', '…That looks like his.']],
  boil: [["Are you okay?! Say something!"], ['CHEF?! Are you okay?! Say something!']],
};

export const TEXTS = {
  come: [["omw. 10 mins. don't move", 'give me a minute, getting a taxi'], ["omw chef. don't move", 'taxi. 5 mins. hide the blue']],
  comeClose: [["on my way. put the kettle on. wait you don't have a kettle"], ['coming chef. put the kettle on. you still don\'t have a kettle']],
  busy: [["can't rn. bring them to me? i'm at "], ["can't rn chef. bring em? i'm at "]],
  where: { home: ["i'm at home. door's open", 'home. the door\'s open'], pier: ['pier. by the railings. wear something normal'], club: ["outside the nightclub. the bouncer's fine, he knew kit"], beach: ['beach, by the van. bring chips'] },
  sold: [['sold out. $', 'cleared the lot. $'], ['sold out chef!!! blue magic. $', 'cleared the lot. $']],
  some: [['sold ', 'another '], ['sold ', 'moved ']],
  out: [['out. need more when you can', 'they keep asking. cook?'], ['CHEF. the people are hungry. cook', "we're out. this is a crisis"]],
  checkin: [['you eat today?', 'where are you'], ['you eat today chef?', 'where you at']],
  checkinClose: [["saw a dog that looked like kit's old dog. that's it. that's the text"], ["saw a dog that looked like kit's old dog. that's it. that's the text"]],
  worry: [['cops outside the mini mart by the park. avoid', "some guy followed me for 2 blocks. i'm fine. i'm fine"], ['cops by the mini mart. avoid chef', 'some guy followed me. i lost him. i\'m basically a ninja']],
  pratt: [['pratt called again', "pratt's guy was outside the building", 'he knows the van. how does he know the van'], ["pratt's guy again. outside. i flipped him off. was that bad", 'pratt called. i let it ring. felt amazing']],
  vic: [["vic sent a selfie from a spa", "vic says he's 'proud of me for staying busy.' if he knew"], ["vic sent a podcast about gratitude. i'm gonna throw my phone in the sea", 'vic says hi. vic can say it to my face']],
  ideas: [[], ['idea. call me', "ok don't be mad but i had another idea"]],
  mood: [[], ['buzzing today. dangerous', 'not today. sorry']],
  ignored: ['hello??', 'ok. fine.'],
};

export const QUICK = [
  ['ok', 'you ok?', [['ish', 'no. but thanks'], ['ish', 'surviving chef']], [['better now'], ['better now. don\'t make it weird']]],
  ['where', 'where are you?', null, null],
  ['how', "how's it going?", null, null],
  ['kit', 'thinking about kit', [['me too. always', "he'd hate that we're sad. he'd make us do something stupid"], ['me too. always', "he'd hate that we're sad. he'd make us do something stupid"]], null, 2],
  ['hang', 'want to hang out?', [['yes. pick me up', "tomorrow. i'm wrecked"], ['YES. pick me up chef', "tomorrow chef. i'm wrecked"]], null, 2],
];

export const CALL = { open: [['Hey.'], ['Yo, Chef.']], openRare: [["What's wrong?"], ["Chef? What's wrong?"]], openClose: [['Hey you.'], ['Chef! Hey.']], bye: [['Okay. Bye.', "Don't do anything stupid."], ['Later, Chef.', "Don't blow up."]], byeFamily: [["Love you. Not like that. Bye."], ["Love you, Chef. Not like that. Bye."]] };

export const SHIFT = [
  ['WREN', 'Okay. Okay okay okay. Do you know what this is?'], ['YOU', '…A bag?'],
  ['WREN', "It's the best thing on this island. Straight up. My people are saying it. A guy at the pier gave it five stars. Out loud. To my face."],
  ['WREN', "You're not a cook. You're a chef. You're Chef. That's it. That's your name now."], ['YOU', "Please don't."],
  ['WREN', 'Too late, Chef.'], ['WREN', 'Yeah, Chef! Blue magic!'],
  ['WREN', "…Kit would've loved this. Like, the name. Not… the rest."],
  ['WREN', "Right! I've got ideas. So many ideas. Most of them are bad. Let's hear them anyway."],
];

export const IDEAS = [
  { id: 'club', pitch: 'Friday. The nightclub. Hear me out.', yes: "Yeah, Chef! Tonight we RIDE.", sum: 'She sells twice as fast for a while, but someone might report dealing at the club.' },
  { id: 'site', pitch: 'New guy at the construction site. Pays double.', yes: "Double, Chef. DOUBLE.", sum: 'A new buyer at the construction site who pays double. He might be a cop, unless June vouches for him.' },
  { id: 'big', pitch: 'Bigger batches, Chef. Go big.', yes: 'Go big or go home! We are not going home.', sum: 'Batches use double the supplies for double the bags, but the cook is harder.' },
  { id: 'price', pitch: "We put the price up. They'll pay.", yes: "Premium product, premium price. Business, Chef.", sum: 'Every bag earns 20% more, but she sells a third slower.' },
  { id: 'van', pitch: 'The van needs a name.', yes: "KIT'S KITCHEN. He'd hate it. He'd love it.", sum: "\"KIT'S KITCHEN\" gets painted on the van." },
  { id: 'ride', pitch: 'Let me ride with you today.', yes: "Shotgun! I mean, the seat. Not a gun. Put that away.", sum: "She comes with you for a while. She won't sell while she's out with you." },
];
export const IDEA_NO = ["Fine. FINE. Your loss.", 'Boo. Okay.', "You're no fun, Chef."];
export const IDEA_SULK = "Do you ever say yes to anything? Like, ever?";
