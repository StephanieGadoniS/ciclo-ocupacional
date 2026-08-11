export interface Relogio {
  agora(): Date;
}

export class RelogioDoSistema implements Relogio {
  agora(): Date {
    return new Date();
  }
}
