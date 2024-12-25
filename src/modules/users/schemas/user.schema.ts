import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
    @Prop()
    name: string;

    @Prop()
    email: string;

    @Prop()
    password: string;

    @Prop({default: "USERS"})
    role: string;

    @Prop({default: "LOCAL"})
    accountType: string;

    @Prop({default: false})
    isActive: boolean;

    // @Prop()
    // codeId: string;

    // @Prop()
    // codeExpired: Date;

    @Prop()
    activationCode: string; // Mã dùng để kích hoạt tài khoản

    @Prop()
    activationCodeExpired: Date; // Hạn sử dụng của mã kích hoạt

    @Prop()
    resetPasswordCode: string; // Mã dùng để đổi mật khẩu

    @Prop()
    resetPasswordCodeExpired: Date; // Hạn sử dụng của mã đổi mật khẩu
}

export const UserSchema = SchemaFactory.createForClass(User);
