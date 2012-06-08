/*
*  6502 assembler and emulator in Javascript
*  (C)2006-2010 Stian Soreng - www.6502asm.com
*
*  Adapted by Nick Morgan
*
*  Released under the GNU General Public License
*  see http://gnu.org/licenses/gpl.html
*
*/

var MAX_MEM = ((32*32)-1);
var codeCompiledOK = false;
var regA = 0;
var regX = 0;
var regY = 0;
var regP = 0;
var regPC = 0x600;
var regSP = 0x100;
var memory = new Array(0x600);
var runForever = false;
var labels = new Labels();
var compiler = new Compiler();
// var emulator = new Emulator();
var codeRunning = false;
var xmlhttp;
var myInterval;
var display = new Array(0x400);
var debug = false;
var palette = [
  "#000000", "#ffffff", "#880000", "#aaffee",
  "#cc44cc", "#00cc55", "#0000aa", "#eeee77",
  "#dd8855", "#664400", "#ff7777", "#333333",
  "#777777", "#aaff66", "#0088ff", "#bbbbbb"
];

function setZeroFlag(value) {
  if (value) {
    regP &= 0xfd;
  } else {
    regP |= 0x02;
  }
}

function setNegativeFlag(value) {
  if (value & 0x80) {
    regP |= 0x80;
  } else {
    regP &= 0x7f;
  }
}

function ORA() {
  setZeroFlag(regA);
  setNegativeFlag(regA);
}

function ASL(value) {
  setZeroFlag(value);
  setNegativeFlag(value);
}

function AND() {
  setZeroFlag(regA);
  setNegativeFlag(regA);
}

function BIT(value) {
  setZeroFlag(value);
  regP = (regP & 0x3f) | (value & 0xc0);
}

function ROL(value) {
  setZeroFlag(value);
  setNegativeFlag(value);
}

var instructions = {

  i00: function () {
    codeRunning = false;
    //BRK
  },

  i01: function () {
    addr = popByte() + regX;
    value = memory[addr] + (memory[addr+1] << 8);
    regA |= value;
    ORA();
  },

  i05: function () {
    zp = popByte();
    regA |= memory[zp];
    ORA();
  },

  i06: function () {
    zp = popByte();
    value = memory[zp];
    regP = (regP & 0xfe) | ((value>>7)&1);
    value = value << 1;
    memStoreByte(zp, value);
    ASL(value);
  },

  i08: function () {
    stackPush(regP);
    //PHP
  },

  i09: function () {
    regA |= popByte();
    ORA();
  },

  i0a: function () {
    regP = (regP & 0xfe) | ((regA>>7)&1);
    regA = regA<<1;
    ASL(regA);
  },

  i0d: function () {
    regA |= memory[popWord()];
    ORA();
  },

  i0e: function () {
    addr = popWord();
    value = memory[addr];
    regP = (regP & 0xfe) | ((value>>7)&1);
    value = value << 1;
    memStoreByte(addr, value);
    ASL(value);
  },

  i10: function () {
    offset = popByte();
    if ((regP & 0x80) == 0) { jumpBranch(offset); }
    //BPL
  },

  i11: function () {
    zp = popByte();
    value = memory[zp] + (memory[zp+1]<<8) + regY;
    regA |= memory[value];
    ORA();
  },

  i15: function () {
    addr = (popByte() + regX) & 0xff;
    regA |= memory[addr];
    ORA();
  },

  i16: function () {
    addr = (popByte() + regX) & 0xff;
    value = memory[addr];
    regP = (regP & 0xfe) | ((value>>7)&1);
    value = value << 1;
    memStoreByte(addr, value);
    ASL(value);
  },

  i18: function () {
    regP &= 0xfe;
    //CLC
  },

  i19: function () {
    addr = popWord() + regY;
    regA |= memory[addr];
    ORA();
  },

  i1d: function () {
    addr = popWord() + regX;
    regA |= memory[addr];
    ORA();
  },

  i1e: function () {
    addr = popWord() + regX;
    value = memory[addr];
    regP = (regP & 0xfe) | ((value>>7)&1);
    value = value << 1;
    memStoreByte(addr, value);
    ASL(value);
  },

  i20: function () {
    addr = popWord();
    currAddr = regPC-1;
    stackPush(((currAddr >> 8) & 0xff));
    stackPush((currAddr & 0xff));
    regPC = addr;
    //JSR
  },

  i21: function () {
    addr = (popByte() + regX)&0xff;
    value = memory[addr]+(memory[addr+1] << 8);
    regA &= value;
    AND();
  },

  i24: function () {
    zp = popByte();
    value = memory[zp];
    BIT(value);
  },

  i25: function () {
    zp = popByte();
    regA &= memory[zp];
    AND();
  },

  i26: function () {
    sf = (regP & 1);
    addr = popByte();
    value = memory[addr]; //  & regA;  -- Thanks DMSC ;)
    regP = (regP & 0xfe) | ((value>>7) & 1);
    value = value << 1;
    value |= sf;
    memStoreByte(addr, value);
    ROL(value);
  },

  i28: function () {
    regP = stackPop() | 0x20;
    //PLP
  },

  i29: function () {
    regA &= popByte();
    AND();
  },

  i2a: function () {
    sf = (regP&1);
    regP = (regP&0xfe) | ((regA>>7)&1);
    regA = regA << 1;
    regA |= sf;
    ROL(regA);
  },

  i2c: function () {
    value = memory[popWord()];
    BIT(value);
  },

  i2d: function () {
    value = memory[popWord()];
    regA &= value;
    AND();
  },

  i2e: function () {
    sf = regP & 1;
    addr = popWord();
    value = memory[addr];
    regP = (regP & 0xfe) | ((value>>7)&1);
    value = value << 1;
    value |= sf;
    memStoreByte(addr, value);
    ROL(value);
  },

  i30: function () {
    offset = popByte();
    if (regP & 0x80) { jumpBranch(offset); }
    //BMI
  },

  i31: function () {
    zp = popByte();
    value = memory[zp]+(memory[zp+1]<<8) + regY;
    regA &= memory[value];
    AND();
  },

  i35: function () {
    zp = popByte();
    value = memory[zp]+(memory[zp+1]<<8) + regX;
    regA &= memory[value];
    AND();
  },

  i36: function () {
    sf = regP & 1;
    addr = (popByte() + regX) & 0xff;
    value = memory[addr];
    regP = (regP & 0xfe) | ((value>>7)&1);
    value = value << 1;
    value |= sf;
    memStoreByte(addr, value);
    ROL(value);
  },

  i38: function () {
    regP |= 1;
    //SEC
  },

  i39: function () {
    addr = popWord() + regY;
    value = memory[addr];
    regA &= value;
    AND();
  },

  i3d: function () {
    addr = popWord() + regX;
    value = memory[addr];
    regA &= value;
    AND();
  },

  i3e: function () {
    sf = regP&1;
    addr = popWord() + regX;
    value = memory[addr];
    regP = (regP & 0xfe) | ((value>>7)&1);
    value = value << 1;
    value |= sf;
    memStoreByte(addr, value);
    ROL(value);
  },

  i40: function () {
    throw new Error("Not implemented");
    //RTI
  },

  i41: function () {
    zp = (popByte() + regX)&0xff;
    value = memory[zp]+ (memory[zp+1]<<8);
    regA ^= memory[value];
    if (regA) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (regA & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  i45: function () {
    addr = (popByte() + regX) & 0xff;
    value = memory[addr];
    regA ^= value;
    if (regA) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (regA & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  i46: function () {
    addr = popByte() & 0xff;
    value = memory[addr];
    regP = (regP & 0xfe) | (value&1);
    value = value >> 1;
    memStoreByte(addr, value);
    if (value != 0) {
      regP &= 0xfd;
    } else {
      regP |= 2;
    }
    if ((value&0x80) == 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  i48: function () {
    stackPush(regA);
  },

  i49: function () {
    regA ^= popByte();
    if (regA) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (regA & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  i4a: function () {
    regP = (regP&0xfe) | (regA&1);
    regA = regA >> 1;
    if (regA) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (regA & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  i4c: function () {
    regPC = popWord();
  },

  i4d: function () {
    addr = popWord();
    value = memory[addr];
    regA ^= value;
    if (regA) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (regA & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  i4e: function () {
    addr = popWord();
    value = memory[addr];
    regP = (regP&0xfe)|(value&1);
    value = value >> 1;
    memStoreByte(addr, value);
    if (value) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (value & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  i50: function () {
    offset = popByte();
    if ((regP & 0x40) == 0) { jumpBranch(offset); }
  },

  i51: function () {
    zp = popByte();
    value = memory[zp] + (memory[zp+1]<<8) + regY;
    regA ^= memory[value];
    if (regA) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (regA & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  i55: function () {
    addr = (popByte() + regX) & 0xff;
    regA ^= memory[ addr ];
    if (regA) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (regA & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  i56: function () {
    addr = (popByte() + regX) & 0xff;
    value = memory[ addr ];
    regP = (regP&0xfe) | (value&1);
    value = value >> 1;
    memStoreByte(addr, value);
    if (value) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (value & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  i58: function () {
  },

  i59: function () {
    addr = popWord() + regY;
    value = memory[ addr ];
    regA ^= value;
    if (regA) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (regA & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  i5d: function () {
    addr = popWord() + regX;
    value = memory[ addr ];
    regA ^= value;
    if (regA) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (regA & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  i5e: function () {
    addr = popWord() + regX;
    value = memory[ addr ];
    regP = (regP&0xfe) | (value&1);
    value = value >> 1;
    memStoreByte(addr, value);
    if (value) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (value & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  i60: function () {
    regPC = (stackPop()+1) | (stackPop()<<8);
  },

  i61: function () {
    zp = (popByte() + regX)&0xff;
    addr = memory[zp] + (memory[zp+1]<<8);
    value = memory[ addr ];
    testADC(value);
  },

  i65: function () {
    addr = popByte();
    value = memory[ addr ];
    testADC(value);
  },

  i66: function () {
    sf = regP&1;
    addr = popByte();
    value = memory[ addr ];
    regP = (regP&0xfe)|(value&1);
    value = value >> 1;
    if (sf) { value |= 0x80; }
    memStoreByte(addr, value);
    if (value) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (value & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  i68: function () {
    regA = stackPop();
    if (regA) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (regA & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  i69: function () {
    value = popByte();
    testADC(value);
  },

  i6a: function () {
    sf = regP&1;
    regP = (regP&0xfe) | (regA&1);
    regA = regA >> 1;
    if (sf) { regA |= 0x80; }
    if (regA) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (regA & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  i6c: function () {
  },

  i6d: function () {
    addr = popWord();
    value = memory[ addr ];
    testADC(value);
  },

  i6e: function () {
    sf = regP&1;
    addr = popWord();
    value = memory[ addr ];
    regP = (regP&0xfe)|(value&1);
    value = value >> 1;
    if (sf) { value |= 0x80; }
    memStoreByte(addr, value);
    if (value) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (value & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  i70: function () {
    offset = popByte();
    if (regP & 0x40) { jumpBranch(offset); }
  },

  i71: function () {
    zp = popByte();
    addr = memory[zp] + (memory[zp+1]<<8);
    value = memory[ addr + regY ];
    testADC(value);
  },

  i75: function () {
    addr = (popByte() + regX) & 0xff;
    value = memory[ addr ];
    regP = (regP&0xfe) | (value&1);
    testADC(value);
  },

  i76: function () {
    sf = (regP&1);
    addr = (popByte() + regX) & 0xff;
    value = memory[ addr ];
    regP = (regP&0xfe) | (value&1);
    value = value >> 1;
    if (sf) { value |= 0x80; }
    memStoreByte(addr, value);
    if (value) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (value & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  i78: function () {
  },

  i79: function () {
    addr = popWord();
    value = memory[ addr + regY ];
    testADC(value);
  },

  i7d: function () {
    addr = popWord();
    value = memory[ addr + regX ];
    testADC(value);
  },

  i7e: function () {
    sf = regP&1;
    addr = popWord() + regX;
    value = memory[ addr ];
    regP = (regP&0xfe) | (value&1);
    value = value >> 1;
    if (value) { value |= 0x80; }
    memStoreByte(addr, value);
    if (value) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (value & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  i81: function () {
    zp = (popByte()+regX)&0xff;
    addr = memory[zp] + (memory[zp+1]<<8);
    memStoreByte(addr, regA);
  },

  i84: function () {
    memStoreByte(popByte(), regY);
  },

  i85: function () {
    memStoreByte(popByte(), regA);
  },

  i86: function () {
    memStoreByte(popByte(), regX);
  },

  i88: function () {
    regY = (regY-1) & 0xff;
    if (regY) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (regY & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  i8a: function () {
    regA = regX & 0xff;
    if (regA) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (regA & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  i8c: function () {
    memStoreByte(popWord(), regY);
  },

  i8d: function () {
    memStoreByte(popWord(), regA);
  },

  i8e: function () {
    memStoreByte(popWord(), regX);
  },

  i90: function () {
    offset = popByte();
    if ((regP & 1) == 0) { jumpBranch(offset); }
  },

  i91: function () {
    zp = popByte();
    addr = memory[zp] + (memory[zp+1]<<8) + regY;
    memStoreByte(addr, regA);
  },

  i94: function () {
    memStoreByte(popByte() + regX, regY);
  },

  i95: function () {
    memStoreByte(popByte() + regX, regA);
  },

  i96: function () {
    memStoreByte(popByte() + regY, regX);
  },

  i98: function () {
    regA = regY & 0xff;
    if (regA) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (regA & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  i99: function () {
    memStoreByte(popWord() + regY, regA);
  },

  i9a: function () {
    regSP = regX & 0xff;
  },

  i9d: function () {
    addr = popWord();
    memStoreByte(addr + regX, regA);
  },

  ia0: function () {
    regY = popByte();
    if (regY) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (regY & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  ia1: function () {
    zp = (popByte()+regX)&0xff;
    addr = memory[zp] + (memory[zp+1]<<8);
    regA = memory[ addr ];
    if (regA) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (regA & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  ia2: function () {
    regX = popByte();
    if (regX) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (regX & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  ia4: function () {
    regY = memory[ popByte() ];
    if (regY) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (regY & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  ia5: function () {
    regA = memory[ popByte() ];
    if (regA) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (regA & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  ia6: function () {
    regX = memory[ popByte() ];
    if (regX) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (regX & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  ia8: function () {
    regY = regA & 0xff;
    if (regY) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (regY & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  ia9: function () {
    regA = popByte();
    if (regA) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (regA & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  iaa: function () {
    regX = regA & 0xff;
    if (regX) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (regX & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  iac: function () {
    regY = memory[ popWord() ];
    if (regY) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (regY & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  iad: function () {
    regA = memory[ popWord() ];
    if (regA) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (regA & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  iae: function () {
    regX = memory[ popWord() ];
    if (regX) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (regX & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  ib0: function () {
    offset = popByte();
    if (regP & 1) { jumpBranch(offset); }
  },

  ib1: function () {
    zp = popByte();
    addr = memory[zp] + (memory[zp+1]<<8) + regY;
    regA = memory[ addr ];
    if (regA) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (regA & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  ib4: function () {
    regY = memory[ popByte() + regX ];
    if (regY) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (regY & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  ib5: function () {
    regA = memory[ (popByte() + regX) & 0xff ];
    if (regA) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (regA & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  ib6: function () {
    regX = memory[ popByte() + regY ];
    if (regX) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (regX & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  ib8: function () {
    regP &= 0xbf;
  },

  ib9: function () {
    addr = popWord() + regY;
    regA = memory[ addr ];
    if (regA) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (regA & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  iba: function () {
    regX = regSP & 0xff;
  },

  ibc: function () {
    addr = popWord() + regX;
    regY = memory[ addr ];
    if (regY) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (regY & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  ibd: function () {
    addr = popWord() + regX;
    regA = memory[ addr ];
    if (regA) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (regA & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  ibe: function () {
    addr = popWord() + regY;
    regX = memory[ addr ];
    if (regX) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (regX & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  ic0: function () {
    value = popByte();
    if ((regY+value) > 0xff) {
      regP |= 1;
    } else {
      regP &= 0xfe;
    }
    ov = value;
    value = (regY-value);
    if (value) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (value & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  ic1: function () {
    zp = popByte();
    addr = memory[zp] + (memory[zp+1]<<8) + regY;
    value = memory[ addr ];
    doCompare(regA, value);
  },

  ic4: function () {
    value = memory[ popByte() ];
    doCompare(regY, value);
  },

  ic5: function () {
    value = memory[ popByte() ];
    doCompare(regA, value);
  },

  ic6: function () {
    zp = popByte();
    value = memory[ zp ];
    --value;
    memStoreByte(zp, value&0xff);
    if (value) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (value & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  ic8: function () {
    regY = (regY + 1) & 0xff;
    if (regY) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (regY & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  ic9: function () {
    value = popByte();
    doCompare(regA, value);
  },

  ica: function () {
    regX = (regX-1) & 0xff;
    if (regX) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (regX & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  icc: function () {
    value = memory[ popWord() ];
    doCompare(regY, value);
  },

  icd: function () {
    value = memory[ popWord() ];
    doCompare(regA, value);
  },

  ice: function () {
    addr = popWord();
    value = memory[ addr ];
    --value;
    value = value&0xff;
    memStoreByte(addr, value);
    if (value) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (value & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  id0: function () {
    offset = popByte();
    if ((regP&2)==0) { jumpBranch(offset); }
  },

  id1: function () {
    zp = popByte();
    addr = memory[zp] + (memory[zp+1]<<8) + regY;
    value = memory[ addr ];
    doCompare(regA, value);
  },

  id5: function () {
    value = memory[ popByte() + regX ];
    doCompare(regA, value);
  },

  id6: function () {
    addr = popByte() + regX;
    value = memory[ addr ];
    --value;
    value = value&0xff;
    memStoreByte(addr, value);
    if (value) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (value & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  id8: function () {
    regP &= 0xf7;
  },

  id9: function () {
    addr = popWord() + regY;
    value = memory[ addr ];
    doCompare(regA, value);
  },

  idd: function () {
    addr = popWord() + regX;
    value = memory[ addr ];
    doCompare(regA, value);
  },

  ide: function () {
    addr = popWord() + regX;
    value = memory[ addr ];
    --value;
    value = value&0xff;
    memStoreByte(addr, value);
    if (value) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (value & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  ie0: function () {
    value = popByte();
    doCompare(regX, value);
  },

  ie1: function () {
    zp = (popByte()+regX)&0xff;
    addr = memory[zp] + (memory[zp+1]<<8);
    value = memory[ addr ];
    testSBC(value);
  },

  ie4: function () {
    value = memory[ popByte() ];
    doCompare(regX, value);
  },

  ie5: function () {
    addr = popByte();
    value = memory[ addr ];
    testSBC(value);
  },

  ie6: function () {
    zp = popByte();
    value = memory[ zp ];
    ++value;
    value = (value)&0xff;
    memStoreByte(zp, value);
    if (value) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (value & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  ie8: function () {
    regX = (regX + 1) & 0xff;
    if (regX) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (regX & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  ie9: function () {
    value = popByte();
    testSBC(value);
  },

  iea: function () {
  },

  iec: function () {
    value = memory[ popWord() ];
    doCompare(regX, value);
  },

  ied: function () {
    addr = popWord();
    value = memory[ addr ];
    testSBC(value);
  },

  iee: function () {
    addr = popWord();
    value = memory[ addr ];
    ++value;
    value = (value)&0xff;
    memStoreByte(addr, value);
    if (value) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (value & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  if0: function () {
    offset = popByte();
    if (regP&2) { jumpBranch(offset); }
  },

  if1: function () {
    zp = popByte();
    addr = memory[zp] + (memory[zp+1]<<8);
    value = memory[ addr + regY ];
    testSBC(value);
  },

  if5: function () {
    addr = (popByte() + regX)&0xff;
    value = memory[ addr ];
    regP = (regP&0xfe)|(value&1);
    testSBC(value);
  },

  if6: function () {
    addr = popByte() + regX;
    value = memory[ addr ];
    ++value;
    value=value&0xff;
    memStoreByte(addr, value);
    if (value) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (value & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  if8: function () {
    regP |= 8;
  },

  if9: function () {
    addr = popWord();
    value = memory[ addr + regY ];
    testSBC(value);
  },

  ifd: function () {
    addr = popWord();
    value = memory[ addr + regX ];
    testSBC(value);
  },

  ife: function () {
    addr = popWord() + regX;
    value = memory[ addr ];
    ++value;
    value=value&0xff;
    memStoreByte(addr, value);
    if (value) {
      regP &= 0xfd;
    } else {
      regP |= 0x02;
    }
    if (value & 0x80) {
      regP |= 0x80;
    } else {
      regP &= 0x7f;
    }
  },

  ierr: function () {
    message("Address $" + addr2hex(regPC) + " - unknown opcode");
    codeRunning = false;
  }
}

function jumpBranch(offset) {
  if (offset > 0x7f) {
    regPC = (regPC - (0x100 - offset));
  } else {
    regPC = (regPC + offset);
  }
}

function doCompare(reg, val) {
  //  if ((reg+val) > 0xff) regP |= 1; else regP &= 0xfe;
  if (reg>=val) {
    regP |= 1;
  } else {
    regP &= 0xfe; // Thanks, "Guest"
  }
  val = (reg-val);
  if (val) {
    regP &= 0xfd;
  } else {
    regP |= 0x02;
  }
  if (val & 0x80) {
    regP |= 0x80;
  } else {
    regP &= 0x7f;
  }
}

function testSBC(value) {
  if ((regA ^ value) & 0x80) {
    vflag = 1;
  } else {
    vflag = 0;
  }

  if (regP & 8) {
    tmp = 0xf + (regA & 0xf) - (value & 0xf) + (regP&1);
    if (tmp < 0x10) {
      w = 0;
      tmp -= 6;
    } else {
      w = 0x10;
      tmp -= 0x10;
    }
    w += 0xf0 + (regA & 0xf0) - (value & 0xf0);
    if (w < 0x100) {
      regP &= 0xfe;
      if ((regP&0xbf) && w<0x80) { regP&=0xbf; }
      w -= 0x60;
    } else {
      regP |= 1;
      if ((regP&0xbf) && w>=0x180) { regP&=0xbf; }
    }
    w += tmp;
  } else {
    w = 0xff + regA - value + (regP&1);
    if (w<0x100) {
      regP &= 0xfe;
      if ((regP&0xbf) && w<0x80) { regP&=0xbf; }
    } else {
      regP |= 1;
      if ((regP&0xbf) && w>= 0x180) { regP&=0xbf; }
    }
  }
  regA = w & 0xff;
  if (regA) {
    regP &= 0xfd;
  } else {
    regP |= 0x02;
  }
  if (regA & 0x80) {
    regP |= 0x80;
  } else {
    regP &= 0x7f;
  }
}

function testADC(value) {
  if ((regA ^ value) & 0x80) {
    regP &= 0xbf;
  } else {
    regP |= 0x40;
  }

  if (regP & 8) {
    tmp = (regA & 0xf) + (value & 0xf) + (regP&1);
    if (tmp >= 10) {
      tmp = 0x10 | ((tmp+6)&0xf);
    }
    tmp += (regA & 0xf0) + (value & 0xf0);
    if (tmp >= 160) {
      regP |= 1;
      if ((regP&0xbf) && tmp >= 0x180) { regP &= 0xbf; }
      tmp += 0x60;
    } else {
      regP &= 0xfe;
      if ((regP&0xbf) && tmp<0x80) { regP &= 0xbf; }
    }
  } else {
    tmp = regA + value + (regP&1);
    if (tmp >= 0x100) {
      regP |= 1;
      if ((regP&0xbf) && tmp>=0x180) { regP &= 0xbf; }
    } else {
      regP &= 0xfe;
      if ((regP&0xbf) && tmp<0x80) { regP &= 0xbf; }
    }
  }
  regA = tmp & 0xff;
  if (regA) {
    regP &= 0xfd;
  } else {
    regP |= 0x02;
  }
  if (regA & 0x80) {
    regP |= 0x80;
  } else {
    regP &= 0x7f;
  }
}


function executeNextInstruction() {
  var instructionName = popByte().toString(16).toLowerCase();
  if (instructionName.length == 1) {
    instructionName = '0' + instructionName;
  }
  var instruction = instructions['i' + instructionName];

  if (instruction) {
    instruction();
  } else {
    instructions.ierr();
  }
}

var Opcodes = [
  /* Name, Imm,  ZP,   ZPX,  ZPY,  ABS,  ABSX, ABSY, INDX, INDY, SNGL, BRA */
  ["ADC", 0x69, 0x65, 0x75, null, 0x6d, 0x7d, 0x79, 0x61, 0x71, null, null],
  ["AND", 0x29, 0x25, 0x35, null, 0x2d, 0x3d, 0x39, 0x21, 0x31, null, null],
  ["ASL", null, 0x06, 0x16, null, 0x0e, 0x1e, null, null, null, 0x0a, null],
  ["BIT", null, 0x24, null, null, 0x2c, null, null, null, null, null, null],
  ["BPL", null, null, null, null, null, null, null, null, null, null, 0x10],
  ["BMI", null, null, null, null, null, null, null, null, null, null, 0x30],
  ["BVC", null, null, null, null, null, null, null, null, null, null, 0x50],
  ["BVS", null, null, null, null, null, null, null, null, null, null, 0x70],
  ["BCC", null, null, null, null, null, null, null, null, null, null, 0x90],
  ["BCS", null, null, null, null, null, null, null, null, null, null, 0xb0],
  ["BNE", null, null, null, null, null, null, null, null, null, null, 0xd0],
  ["BEQ", null, null, null, null, null, null, null, null, null, null, 0xf0],
  ["BRK", null, null, null, null, null, null, null, null, null, 0x00, null],
  ["CMP", 0xc9, 0xc5, 0xd5, null, 0xcd, 0xdd, 0xd9, 0xc1, 0xd1, null, null],
  ["CPX", 0xe0, 0xe4, null, null, 0xec, null, null, null, null, null, null],
  ["CPY", 0xc0, 0xc4, null, null, 0xcc, null, null, null, null, null, null],
  ["DEC", null, 0xc6, 0xd6, null, 0xce, 0xde, null, null, null, null, null],
  ["EOR", 0x49, 0x45, 0x55, null, 0x4d, 0x5d, 0x59, 0x41, 0x51, null, null],
  ["CLC", null, null, null, null, null, null, null, null, null, 0x18, null],
  ["SEC", null, null, null, null, null, null, null, null, null, 0x38, null],
  ["CLI", null, null, null, null, null, null, null, null, null, 0x58, null],
  ["SEI", null, null, null, null, null, null, null, null, null, 0x78, null],
  ["CLV", null, null, null, null, null, null, null, null, null, 0xb8, null],
  ["CLD", null, null, null, null, null, null, null, null, null, 0xd8, null],
  ["SED", null, null, null, null, null, null, null, null, null, 0xf8, null],
  ["INC", null, 0xe6, 0xf6, null, 0xee, 0xfe, null, null, null, null, null],
  ["JMP", null, null, null, null, 0x4c, null, null, null, null, null, null],
  ["JSR", null, null, null, null, 0x20, null, null, null, null, null, null],
  ["LDA", 0xa9, 0xa5, 0xb5, null, 0xad, 0xbd, 0xb9, 0xa1, 0xb1, null, null],
  ["LDX", 0xa2, 0xa6, null, 0xb6, 0xae, null, 0xbe, null, null, null, null],
  ["LDY", 0xa0, 0xa4, 0xb4, null, 0xac, 0xbc, null, null, null, null, null],
  ["LSR", null, 0x46, 0x56, null, 0x4e, 0x5e, null, null, null, 0x4a, null],
  ["NOP", null, null, null, null, null, null, null, null, null, 0xea, null],
  ["ORA", 0x09, 0x05, 0x15, null, 0x0d, 0x1d, 0x19, 0x01, 0x11, null, null],
  ["TAX", null, null, null, null, null, null, null, null, null, 0xaa, null],
  ["TXA", null, null, null, null, null, null, null, null, null, 0x8a, null],
  ["DEX", null, null, null, null, null, null, null, null, null, 0xca, null],
  ["INX", null, null, null, null, null, null, null, null, null, 0xe8, null],
  ["TAY", null, null, null, null, null, null, null, null, null, 0xa8, null],
  ["TYA", null, null, null, null, null, null, null, null, null, 0x98, null],
  ["DEY", null, null, null, null, null, null, null, null, null, 0x88, null],
  ["INY", null, null, null, null, null, null, null, null, null, 0xc8, null],
  ["ROR", null, 0x66, 0x76, null, 0x6e, 0x7e, null, null, null, 0x6a, null],
  ["ROL", null, 0x26, 0x36, null, 0x2e, 0x3e, null, null, null, 0x2a, null],
  ["RTI", null, null, null, null, null, null, null, null, null, 0x40, null],
  ["RTS", null, null, null, null, null, null, null, null, null, 0x60, null],
  ["SBC", 0xe9, 0xe5, 0xf5, null, 0xed, 0xfd, 0xf9, 0xe1, 0xf1, null, null],
  ["STA", null, 0x85, 0x95, null, 0x8d, 0x9d, 0x99, 0x81, 0x91, null, null],
  ["TXS", null, null, null, null, null, null, null, null, null, 0x9a, null],
  ["TSX", null, null, null, null, null, null, null, null, null, 0xba, null],
  ["PHA", null, null, null, null, null, null, null, null, null, 0x48, null],
  ["PLA", null, null, null, null, null, null, null, null, null, 0x68, null],
  ["PHP", null, null, null, null, null, null, null, null, null, 0x08, null],
  ["PLP", null, null, null, null, null, null, null, null, null, 0x28, null],
  ["STX", null, 0x86, null, 0x96, 0x8e, null, null, null, null, null, null],
  ["STY", null, 0x84, 0x94, null, 0x8c, null, null, null, null, null, null],
  ["---", null, null, null, null, null, null, null, null, null, null, null]
];

// Initialize everything.

$('#compileButton').attr('disabled', false);
$('#runButton').attr('disabled', true);
$('#hexdumpButton').attr('disabled', true);
$('#fileSelect').attr('disabled', false);
$('#watch').attr('checked', false);
$('#stepButton').attr('disabled', true);
$('#gotoButton').attr('disabled', true);

// Paint the "display"

html = '<table class="screen">';
for (y=0; y<32; y++) {
  html += "<tr>";
  for (x=0; x<32; x++) {
    html += '<td class="screen" id="x' + x + 'y' + y + '"></td>';
  }
  html += "</tr>";
}
html += "</table>";
$('#screen').html(html);

// Reset everything

reset();

/*
*  keyPress() - Store keycode in ZP $ff
*
*/

function keyPress(e) {
  if (typeof window.event != "undefined") {
    e = window.event;
  }
  if (e.type == "keypress") {
    value = e.which;
    memStoreByte(0xff, value);
  }
}

/*
*  debugExec() - Execute one instruction and print values
*/

function debugExec() {
  if (codeRunning) {
    execute();
  }
  updateDebugInfo();
}

function updateDebugInfo() {
  var html = "<br />";
  html += "A=$" + num2hex(regA)+" X=$" + num2hex(regX)+" Y=$" + num2hex(regY)+"<br />";
  html += "P=$" + num2hex(regP)+" SP=$"+addr2hex(regSP)+" PC=$" + addr2hex(regPC);
  $('#md').html(html);
}

/*
*  gotoAddr() - Set PC to address (or address of label)
*
*/

function gotoAddr() {
  var inp = prompt("Enter address or label", "");
  var addr = 0;
  if (labels.find(inp)) {
    addr = labels.getPC(inp);
  } else {
    if (inp.match(/^0x[0-9a-f]{1,4}$/i)) {
      inp = inp.replace(/^0x/, "");
      addr = parseInt(inp, 16);
    } else if (inp.match(/^\$[0-9a-f]{1,4}$/i)) {
      inp = inp.replace(/^\$/, "");
      addr = parseInt(inp, 16);
    }
  }
  if (addr == 0) {
    alert("Unable to find/parse given address/label");
  } else {
    regPC = addr;
  }
  updateDebugInfo();
}


function stopDebugger() {
  debug = false;
  if (codeRunning) {
    $('#stepButton').attr('disabled', true);
    $('#gotoButton').attr('disabled', true);
  }
}

function enableDebugger() {
  debug = true;
  if (codeRunning) {
    updateDebugInfo();
    $('#stepButton').attr('disabled', false);
    $('#gotoButton').attr('disabled', false);
  }
}

function toggleDebug(e) {
  if (e) {
    debug = $(this).is(':checked');
  } else {
    debug = !debug;
  }
  if (debug) {
    enableDebugger();
  } else {
    stopDebugger();
  }
}


/*
*  disableButtons() - Disables the Run and Debug buttons when text is
*                     altered in the code editor
*
*/

function disableButtons() {
  $('#compileButton').attr('disabled', false);
  $('#runButton').attr('disabled', true);
  $('#hexdumpButton').attr('disabled', true);
  $('#fileSelect').attr('disabled', false);
  $('#runButton').val('Run');

  codeCompiledOK = false;
  codeRunning = false;
  $('#code').focus();
  $('#stepButton').attr('disabled', true);
  $('#gotoButton').attr('disabled', true);
  clearInterval(myInterval);
}

function Load(file) {
  reset();
  disableButtons();
  $('#code').val("Loading, please wait..");
  $('#compileButton').attr('disabled', true);
  xmlhttp = new XMLHttpRequest();
  xmlhttp.onreadystatechange = FileLoaded;
  xmlhttp.open("GET", "/examples/" + file);
  xmlhttp.send(null);
  stopDebugger();
}

function FileLoaded() {
  if (xmlhttp.readyState == 4) {
    if (xmlhttp.status == 200) {
      $('#code').val(xmlhttp.responseText);
      $('#compileButton').attr('disabled', false);
    }
  }
}

/*
*  reset() - Reset CPU and memory.
*
*/

function reset() {
  for (y=0; y<32; y++) {
    for (x=0; x<32; x++) {
      display[y*32+x] = $('#x'+x+'y'+y)[0].style;
      display[y*32+x].background = "#000000";
    }
  }
  for (x=0; x<0x600; x++) { // clear ZP, stack and screen
    memory[x] = 0x00;
  }
  regA = regX = regY = 0;
  regPC = 0x600;
  regSP = 0x100;
  regP = 0x20;
  runForever = false;
  $('#watch').attr('checked', false);
}


/*
*  message() - Prints text in the message window
*
*/

function message(text) {
  $('#messages').append(text + '<br>').scrollTop(10000);
}


function Labels() {
  var labelIndex = [];

  function indexLines(lines) {
    for (var i = 0; i < lines.length; i++) {
      if (! indexLine(lines[i])) {
        message("<b>Label already defined at line "+(i + 1)+":</b> "+lines[i]);
        return false;
      }
    }
    return true;
  }

  /*
  * indexLine(line) - extract label if line contains one and calculate position in memory.
  * Return false if label alread exists.
  */


  function indexLine(input) {
    // remove comments
    input = input.replace(/^(.*?);.*/, "$1");

    // trim line
    input = input.replace(/^\s+/, "");
    input = input.replace(/\s+$/, "");

    // Figure out how many bytes this instruction takes
    var currentPC = compiler.getCurrentPC();
    compiler.compileLine(input); //TODO: find a better way for Labels to have access to compiler

    // Find command or label
    if (input.match(/^\w+:/)) {
      label = input.replace(/(^\w+):.*$/, "$1");
      return push(label + "|" + currentPC);
    }
    return true;
  }

  /*
  *  push() - Push label to array. Return false if label already exists.
  */

  function push(name) {
    if (find(name)) {
      return false;
    }
    labelIndex.push(name + "|");
    return true;
  }

  /*
  *  find() - Returns true if label exists.
  */

  function find(name) {
    for (m=0; m<labelIndex.length; m++) {
      nameAndAddr = labelIndex[m].split("|");
      if (name == nameAndAddr[0]) {
        return true;
      }
    }
    return false;
  }

  /*
  *  setPC() - Associates label with address
  */

  function setPC(name, addr) {
    for (i=0; i<labelIndex.length; i++) {
      nameAndAddr = labelIndex[i].split("|");
      if (name == nameAndAddr[0]) {
        labelIndex[i] = name + "|" + addr;
        return true;
      }
    }
    return false;
  }

  /*
  *  getPC() - Get address associated with label
  */

  function getPC(name) {
    for (i=0; i<labelIndex.length; i++) {
      nameAndAddr = labelIndex[i].split("|");
      if (name == nameAndAddr[0]) {
        return (nameAndAddr[1]);
      }
    }
    return -1;
  }

  function displayMessage() {
    str = "Found " + labelIndex.length + " label";
    if (labelIndex.length != 1) {
      str += "s";
    }
    message(str + ".");
  }

  function reset() {
    labelIndex = [];
  }

  this.indexLines = indexLines;
  this.find = find;
  this.getPC = getPC;
  this.displayMessage = displayMessage;
  this.reset = reset;
}

/*
*  compileCode()
*
*  "Compiles" the code into memory
*
*/

function Compiler() {
  var defaultCodePC;
  var codeLen;

  function compileCode() {
    reset();
    labels.reset();
    defaultCodePC = 0x600;
    $('#messages').empty();

    var code = $('#code').val();
    code += "\n\n";
    lines = code.split("\n");
    codeCompiledOK = true;

    message("Indexing labels..");

    defaultCodePC = 0x600;

    if (!labels.indexLines(lines)) {
      return false;
    }

    labels.displayMessage();

    defaultCodePC = 0x600;
    message("Compiling code..");

    codeLen = 0;
    for (var i = 0; i < lines.length; i++) {
      if (! compileLine(lines[i], i)) {
        codeCompiledOK = false;
        break;
      }
    }

    if (codeLen == 0) {
      codeCompiledOK = false;
      message("No code to run.");
    }

    if (codeCompiledOK) {
      $('#runButton').attr('disabled', false);
      $('#hexdumpButton').attr('disabled', false);
      $('#compileButton').attr('disabled', true);
      $('#fileSelect').attr('disabled', false);
      memory[defaultCodePC] = 0x00; //set a null byte at the end of the code
    } else {
      str = lines[x].replace("<", "&lt;").replace(">", "&gt;");
      message("<b>Syntax error line " + (x+1) + ": " + str + "</b>");
      $('#runButton').attr('disabled', true);
      $('#compileButton').attr('disabled', false);
      $('#fileSelect').attr('disabled', false);
      return;
    }

    updateDisplayFull();
    message("Code compiled successfully, " + codeLen + " bytes.");
  }

  /*
  *  compileLine()
  *
  *  Compiles one line of code.  Returns true if it compiled successfully,
  *  false otherwise.
  */

  function compileLine(input, lineno) {

    // remove comments

    input = input.replace(/^(.*?);.*/, "$1");

    // trim line

    input = input.replace(/^\s+/, "");
    input = input.replace(/\s+$/, "");

    // Find command or label

    if (input.match(/^\w+:/)) {
      label = input.replace(/(^\w+):.*$/, "$1");
      if (input.match(/^\w+:[\s]*\w+.*$/)) {
        input = input.replace(/^\w+:[\s]*(.*)$/, "$1");
        command = input.replace(/^(\w+).*$/, "$1");
      } else {
        command = "";
      }
    } else {
      command = input.replace(/^(\w+).*$/, "$1");
    }

    // Blank line?  Return.

    if (command == "") {
      return true;
    }

    command = command.toUpperCase();

    if (input.match(/^\*[\s]*=[\s]*[\$]?[0-9a-f]*$/)) {
      // equ spotted
      param = input.replace(/^[\s]*\*[\s]*=[\s]*/, "");
      if (param[0] == "$") {
        param = param.replace(/^\$/, "");
        addr = parseInt(param, 16);
      } else {
        addr = parseInt(param, 10);
      }
      if ((addr < 0) || (addr > 0xffff)) {
        message("Unable to relocate code outside 64k memory");
        return false;
      }
      defaultCodePC = addr;
      return true;
    }

    if (input.match(/^\w+\s+.*?$/)) {
      param = input.replace(/^\w+\s+(.*?)/, "$1");
    } else {
      if (input.match(/^\w+$/)) {
        param = "";
      } else {
        return false;
      }
    }

    param = param.replace(/[ ]/g, "");

    if (command == "DCB") {
      return DCB(param);
    }


    for (o=0; o<Opcodes.length; o++) {
      if (Opcodes[o][0] == command) {
        if (checkSingle(param, Opcodes[o][10])) { return true; }
        if (checkImmediate(param, Opcodes[o][1])) { return true; }
        if (checkZeroPage(param, Opcodes[o][2])) { return true; }
        if (checkZeroPageX(param, Opcodes[o][3])) { return true; }
        if (checkZeroPageY(param, Opcodes[o][4])) { return true; }
        if (checkAbsoluteX(param, Opcodes[o][6])) { return true; }
        if (checkAbsoluteY(param, Opcodes[o][7])) { return true; }
        if (checkIndirectX(param, Opcodes[o][8])) { return true; }
        if (checkIndirectY(param, Opcodes[o][9])) { return true; }
        if (checkAbsolute(param, Opcodes[o][5])) { return true; }
        if (checkBranch(param, Opcodes[o][11])) { return true; }
      }
    }
    return false; // Unknown opcode
  }

  function DCB(param) {
    values = param.split(",");
    if (values.length == 0) { return false; }
    for (v=0; v<values.length; v++) {
      str = values[v];
      if (str != undefined && str != null && str.length > 0) {
        ch = str.substring(0, 1);
        if (ch == "$") {
          number = parseInt(str.replace(/^\$/, ""), 16);
          pushByte(number);
        } else if (ch >= "0" && ch <= "9") {
          number = parseInt(str, 10);
          pushByte(number);
        } else {
          return false;
        }
      }
    }
    return true;
  }

  /*
  *  checkBranch() - Commom branch function for all branches (BCC, BCS, BEQ, BNE..)
  *
  */

  function checkBranch(param, opcode) {
    if (opcode == null) { return false; }

    addr = -1;
    if (param.match(/\w+/)) {
      addr = labels.getPC(param);
    }
    if (addr == -1) { pushWord(0x00); return false; }
    pushByte(opcode);
    if (addr < (defaultCodePC-0x600)) {  // Backwards?
      pushByte((0xff - ((defaultCodePC-0x600)-addr)) & 0xff);
      return true;
    }
    pushByte((addr-(defaultCodePC-0x600)-1) & 0xff);
    return true;
  }

  /*
  * checkImmediate() - Check if param is immediate and push value
  *
  */

  function checkImmediate(param, opcode) {
    if (opcode == null) { return false; }
    if (param.match(/^#\$[0-9a-f]{1,2}$/i)) {
      pushByte(opcode);
      value = parseInt(param.replace(/^#\$/, ""), 16);
      if (value < 0 || value > 255) { return false; }
      pushByte(value);
      return true;
    }
    if (param.match(/^#[0-9]{1,3}$/i)) {
      pushByte(opcode);
      value = parseInt(param.replace(/^#/, ""), 10);
      if (value < 0 || value > 255) { return false; }
      pushByte(value);
      return true;
    }
    // Label lo/hi
    if (param.match(/^#[<>]\w+$/)) {
      label = param.replace(/^#[<>](\w+)$/, "$1");
      hilo = param.replace(/^#([<>]).*$/, "$1");
      pushByte(opcode);
      if (labels.find(label)) {
        addr = labels.getPC(label);
        switch(hilo) {
        case ">":
          pushByte((addr >> 8) & 0xff);
          return true;
          break;
        case "<":
          pushByte(addr & 0xff);
          return true;
          break;
        default:
          return false;
          break;
        }
      } else {
        pushByte(0x00);
        return true;
      }
    }
    return false;
  }

  /*
  * checkIndirectX() - Check if param is indirect X and push value
  *
  */

  function checkIndirectX(param, opcode) {
    if (opcode == null) { return false; }
    if (param.match(/^\(\$[0-9a-f]{1,2},X\)$/i)) {
      pushByte(opcode);
      value = param.replace(/^\(\$([0-9a-f]{1,2}).*$/i, "$1");
      if (value < 0 || value > 255) { return false; }
      pushByte(parseInt(value, 16));
      return true;
    }
    return false;
  }

  /*
  * checkIndirectY() - Check if param is indirect Y and push value
  *
  */

  function checkIndirectY(param, opcode) {
    if (opcode == null) { return false; }
    if (param.match(/^\(\$[0-9a-f]{1,2}\),Y$/i)) {
      pushByte(opcode);
      value = param.replace(/^\([\$]([0-9a-f]{1,2}).*$/i, "$1");
      if (value < 0 || value > 255) { return false; }
      pushByte(parseInt(value, 16));
      return true;
    }
    return false;
  }

  /*
  *  checkSingle() - Single-byte opcodes
  *
  */

  function checkSingle(param, opcode) {
    if (opcode === null) { return false; }
    if (param != "") { return false; }
    pushByte(opcode);
    return true;
  }

  /*
  *  checkZeroPage() - Check if param is ZP and push value
  *
  */

  function checkZeroPage(param, opcode) {
    if (opcode == null) { return false; }
    if (param.match(/^\$[0-9a-f]{1,2}$/i)) {
      pushByte(opcode);
      value = parseInt(param.replace(/^\$/, ""), 16);
      if (value < 0 || value > 255) { return false; }
      pushByte(value);
      return true;
    }
    if (param.match(/^[0-9]{1,3}$/i)) {
      pushByte(opcode);
      value = parseInt(param, 10);
      if (value < 0 || value > 255) { return false; }
      pushByte(value);
      return true;
    }
    return false;
  }

  /*
  *  checkAbsoluteX() - Check if param is ABSX and push value
  *
  */

  function checkAbsoluteX(param, opcode) {
    if (opcode == null) { return false; }
    if (param.match(/^\$[0-9a-f]{3,4},X$/i)) {
      pushByte(opcode);
      number = param.replace(/^\$([0-9a-f]*),X/i, "$1");
      value = parseInt(number, 16);
      if (value < 0 || value > 0xffff) { return false; }
      pushWord(value);
      return true;
    }

    if (param.match(/^\w+,X$/i)) {
      param = param.replace(/,X$/i, "");
      pushByte(opcode);
      if (labels.find(param)) {
        addr = labels.getPC(param);
        if (addr < 0 || addr > 0xffff) { return false; }
        pushWord(addr);
        return true;
      } else {
        pushWord(0x1234);
        return true;
      }
    }

    return false;
  }

  /*
  *  checkAbsoluteY() - Check if param is ABSY and push value
  *
  */

  function checkAbsoluteY(param, opcode) {
    if (opcode == null) { return false; }
    if (param.match(/^\$[0-9a-f]{3,4},Y$/i)) {
      pushByte(opcode);
      number = param.replace(/^\$([0-9a-f]*),Y/i, "$1");
      value = parseInt(number, 16);
      if (value < 0 || value > 0xffff) { return false; }
      pushWord(value);
      return true;
    }

    // it could be a label too..

    if (param.match(/^\w+,Y$/i)) {
      param = param.replace(/,Y$/i, "");
      pushByte(opcode);
      if (labels.find(param)) {
        addr = labels.getPC(param);
        if (addr < 0 || addr > 0xffff) { return false; }
        pushWord(addr);
        return true;
      } else {
        pushWord(0x1234);
        return true;
      }
    }
    return false;
  }

  /*
  *  checkZeroPageX() - Check if param is ZPX and push value
  *
  */

  function checkZeroPageX(param, opcode) {
    if (opcode == null) { return false; }
    if (param.match(/^\$[0-9a-f]{1,2},X/i)) {
      pushByte(opcode);
      number = param.replace(/^\$([0-9a-f]{1,2}),X/i, "$1");
      value = parseInt(number, 16);
      if (value < 0 || value > 255) { return false; }
      pushByte(value);
      return true;
    }
    if (param.match(/^[0-9]{1,3},X/i)) {
      pushByte(opcode);
      number = param.replace(/^([0-9]{1,3}),X/i, "$1");
      value = parseInt(number, 10);
      if (value < 0 || value > 255) { return false; }
      pushByte(value);
      return true;
    }
    return false;
  }

  function checkZeroPageY(param, opcode) {
    if (opcode == null) { return false; }
    if (param.match(/^\$[0-9a-f]{1,2},Y/i)) {
      pushByte(opcode);
      number = param.replace(/^\$([0-9a-f]{1,2}),Y/i, "$1");
      value = parseInt(number, 16);
      if (value < 0 || value > 255) { return false; }
      pushByte(value);
      return true;
    }
    if (param.match(/^[0-9]{1,3},Y/i)) {
      pushByte(opcode);
      number = param.replace(/^([0-9]{1,3}),Y/i, "$1");
      value = parseInt(number, 10);
      if (value < 0 || value > 255) { return false; }
      pushByte(value);
      return true;
    }
    return false;
  }

  /*
  *  checkAbsolute() - Check if param is ABS and push value
  *
  */

  function checkAbsolute(param, opcode) {
    if (opcode == null) { return false; }
    pushByte(opcode);
    if (param.match(/^\$[0-9a-f]{3,4}$/i)) {
      value = parseInt(param.replace(/^\$/, ""), 16);
      if (value < 0 || value > 0xffff) { return false; }
      pushWord(value);
      return true;
    }
    if (param.match(/^[0-9]{1,5}$/i)) {  // Thanks, Matt!
      value = parseInt(param, 10);
      if (value < 0 || value > 65535) { return false; }
      pushWord(value);
      return(true);
    }
    // it could be a label too..
    if (param.match(/^\w+$/)) {
      if (labels.find(param)) {
        addr = (labels.getPC(param));
        if (addr < 0 || addr > 0xffff) { return false; }
        pushWord(addr);
        return true;
      } else {
        pushWord(0x1234);
        return true;
      }
    }
    return false;
  }

  /*
  * pushByte() - Push byte to memory
  *
  */

  function pushByte(value) {
    memory[defaultCodePC] = value & 0xff;
    defaultCodePC++;
    codeLen++;
  }

  /*
  * pushWord() - Push a word using pushByte twice
  *
  */

  function pushWord(value) {
    pushByte(value & 0xff);
    pushByte((value>>8) & 0xff);
  }

  /*
  *  hexDump() - Dump binary as hex to new window
  *
  */

  function hexdump() {
    w = window.open('', 'hexdump', 'width=500,height=300,resizable=yes,scrollbars=yes,toolbar=no,location=no,menubar=no,status=no');

    html = "<html><head>";
    html += "<link href='style.css' rel='stylesheet' type='text/css' />";
    html += "<title>hexdump</title></head><body>";
    html += "<code>";
    for (x=0; x<codeLen; x++) {
      if ((x&15) == 0) {
        html += "<br/> ";
        n = (0x600+x);
        html += num2hex(((n>>8)&0xff));
        html += num2hex((n&0xff));
        html += ": ";
      }
      html += num2hex(memory[0x600+x]);
      if (x&1) { html += " "; }
    }
    if ((x&1)) { html += "-- [END]"; }
    html += "</code></body></html>";
    w.document.write(html);
    w.document.close();
  }

  return {
    compileLine: compileLine,
    compileCode: compileCode,
    getCurrentPC: function () {
      return defaultCodePC;
    },
    hexdump: hexdump
  };
}



function stackPush(value) {
  if (regSP >= 0) {
    regSP--;
    memory[(regSP&0xff)+0x100] = value & 0xff;
  } else {
    message("Stack full: " + regSP);
    codeRunning = false;
  }
}

function stackPop() {
  if (regSP < 0x100) {
    value = memory[regSP+0x100];
    regSP++;
    return value;
  } else {
    message("Stack empty");
    codeRunning = false;
    return 0;
  }
}

/*
* popByte() - Pops a byte
*
*/

function popByte() {
  return(memory[regPC++] & 0xff);
}

/*
* popWord() - Pops a word using popByte() twice
*
*/

function popWord() {
  return popByte() + (popByte() << 8);
}

/*
* memStoreByte() - Poke a byte, don't touch any registers
*
*/

function memStoreByte(addr, value) {
  memory[ addr ] = (value & 0xff);
  if ((addr >= 0x200) && (addr<=0x5ff)) {
    display[addr-0x200].background = palette[memory[addr] & 0x0f];
  }
}

function addr2hex(addr) {
  return num2hex((addr>>8)&0xff)+num2hex(addr&0xff);
}

function num2hex(nr) {
  str = "0123456789abcdef";
  hi = ((nr&0xf0)>>4);
  lo = (nr&15);
  return str.substring(hi, hi+1 ) + str.substring(lo, lo+1);
}

/*
*  runBinary() - Executes the compiled code
*
*/

function runBinary() {
  if (codeRunning) {
    /* Switch OFF everything */
    codeRunning = false;
    $('#runButton').val('Run');
    $('#hexdumpButton').attr('disabled', false);
    $('#fileSelect').attr('disabled', false);
    toggleDebug();
    stopDebugger();
    clearInterval(myInterval);
  } else {
    $('#runButton').val('Stop');
    $('#fileSelect').attr('disabled', true);
    $('#hexdumpButton').attr('disabled', true);
    codeRunning = true;
    myInterval = setInterval(multiexecute, 30);
    $('#stepButton').attr('disabled', !debug);
    $('#gotoButton').attr('disabled', !debug);
  }
}

function multiexecute() {
  if (! debug) {
    for (var w=0; w<200; w++) {
      execute();
    }
  }
}

/*
*  execute() - Executes one instruction.
*              This is the main part of the CPU emulator.
*
*/

function execute() {
  if (! codeRunning) { return; }

  setRandomByte();
  executeNextInstruction();

  if ((regPC == 0) || (!codeRunning)) {
    clearInterval(myInterval);
    message("Program end at PC=$" + addr2hex(regPC-1));
    codeRunning = false;
    $('#stepButton').attr('disabled', true);
    $('#gotoButton').attr('disabled', true);
    $('#runButton').val('Run');
    $('#fileSelect').attr('disabled', false);
    $('#hexdumpButton').attr('disabled', false);
  }
}


function setRandomByte() {
  memory[0xfe] = Math.floor(Math.random()*256);
}

function updateDisplayPixel(addr) {
  display[addr-0x200].background = palette[memory[addr] & 0x0f];
}


/*
*  updateDisplayFull() - Simply redraws the entire display according to memory
*  The colors are supposed to be identical with the C64's palette.
*
*/

function updateDisplayFull() {
  for (y=0; y<32; y++) {
    for (x=0; x<32; x++) {
      updateDisplayPixel(((y<<5)+x) + 0x200);
    }
  }
}

$(document).ready(function () {
  $('#compileButton').click(function () {
    compiler.compileCode();
  });
  $('#runButton').click(runBinary);
  $('#resetButton').click(reset);
  $('#hexdumpButton').click(compiler.hexdump);
  $('#watch').change(toggleDebug);
  $('#stepButton').click(debugExec);
  $('#gotoButton').click(gotoAddr);
  $('#code').keypress(disableButtons);
  $(document).keypress(keyPress);
});
