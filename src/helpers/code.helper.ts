import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';

export const generateVerificationCode = (minutes = 30) => {
  return {
    codeId: uuidv4(),
    codeExpired: dayjs().add(minutes, 'minutes').toDate(),
  };
};

export const isCodeValid = (codeExpired: Date) => {
  return dayjs().isBefore(dayjs(codeExpired));
};
