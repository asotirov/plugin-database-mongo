module.exports = function (options) {
    const utilities = options.utilities;
    return function importModelsFunction(sequelize, database, DataTypes) {
        const City = sequelize.define('city', {
                    name: DataTypes.STRING,
                    isActive: {
                        type: DataTypes.BOOLEAN,
                        defaultValue: true
                    }
                }, {
                    tableName: 'cities',
                    timestamps: true
                });

                const Country = sequelize.define('country', {
                    name: DataTypes.STRING,
                    code: DataTypes.STRING,
                    isDefault: DataTypes.BOOLEAN,
                    isActive: {
                        type: DataTypes.BOOLEAN,
                        defaultValue: true
                    }
                }, {
                    tableName: 'countries',
                    timestamps: false
                });
                const User = sequelize.define('user', {
                    birthday: {
                        type: DataTypes.DATE,
                        allowNull: true
                    },
                    isActive: {
                        type: DataTypes.BOOLEAN,
                        defaultValue: true
                    },
                    firstName: {
                        type: DataTypes.STRING
                    },
                    lastName: {
                        type: DataTypes.STRING
                    },
                    timezone: {
                        type: DataTypes.STRING
                    },
                    lng: {
                        type: DataTypes.DOUBLE
                    },
                    lat: {
                        type: DataTypes.DOUBLE
                    }
                }, {
                    instanceMethods: {
                        privateJSON: function () {
                            return utilities.transformThatObject(this, ['fullName',
                                'firstName',
                                'lastName',
                                'email',
                                'sex',
                                'lat',
                                'lng',
                                'birthday',
                                'token',
                                'avatar',
                                'cityId',
                                'countryId',
                                'timezone',
                                'languageId',
                                {'city': 'city.name'},
                                {'country': 'country.name'},
                                {'language': 'language.name'},
                                'providerInfo',
                                'percent',
                                'cover',
                                {'setting': (u) => database.Settings.getSettingsResult(u.setting)},
                                'id'
                            ]);
                        }
                    },
                    getterMethods: {
                        fullName: function () {
                            return this.firstName + ' ' + this.lastName;
                        }
                    },
                    timestamps: true,
                    tableName: 'user'
                });

                const Language = sequelize.define('language', {
                    name: DataTypes.STRING,
                    code: DataTypes.STRING,
                    isDefault: DataTypes.BOOLEAN,
                    isActive: {
                        type: DataTypes.BOOLEAN,
                        defaultValue: true
                    }
                }, {
                    timestamps: false
                });

                User.belongsTo(Language);
                User.belongsTo(City);
                User.belongsTo(Country);


                const defaultSettings = {
                    disableNotificationEmail: false,
                    matchStrangers: true,
                    matchFriends: true
                };

                let Settings = sequelize.define('settings', {
                    disableNotificationEmail: DataTypes.BOOLEAN,
                    matchStrangers: DataTypes.BOOLEAN,
                    matchFriends: DataTypes.BOOLEAN
                }, {
                    classMethods: {
                        getSettingsResult: (settings) => {
                            settings = settings || {};
                            if (settings && settings.dataValues) {
                                settings = settings.dataValues;
                            }
                            return _.chain(settings).pick(_.keys(defaultSettings)).defaults(defaultSettings).value();
                        }
                    },
                    instanceMethods: {
                        toJSON: function () {
                            return Settings.getSettingsResult(this.dataValues);
                        }
                    }
                });

                User.hasOne(Settings);

                const relationTypes = {
                    event: 'event',
                    friends: 'friends',
                    matched: 'matched'
                };
                const Relation = sequelize.define('relation', {
                    type: DataTypes.ENUM.apply(DataTypes.ENUM, _.keys(relationTypes)),
                    blockedLow: DataTypes.BOOLEAN,
                    blockedHigh: DataTypes.BOOLEAN
                }, {
                    classMethods: {
                        getRelationsForUser: (userId, include = true) => {
                            return Relation.findAll({
                                where: {
                                    $or: [
                                        {
                                            userIdLow: userId
                                        },
                                        {
                                            userIdHigh: userId
                                        }
                                    ]
                                },
                                include: include ? [{
                                    model: User, as: 'userHigh', include: [{model: Settings}]
                                }, {
                                    model: User, as: 'userLow', include: [{model: Settings}]
                                }] : []
                            }).then((rows) => {
                                rows = _.chain(rows).map((r) => {
                                    let otherUserId = r.userIdHigh === userId ? r.userIdLow : r.userIdHigh;
                                    let user = include && otherUserId === r.userHigh ? r.userHigh.privateJSON() : include ? r.userLow.privateJSON() : null;
                                    return {
                                        user,
                                        type: r.type,
                                        settingHigh: _.get(r, 'userHigh.setting'),
                                        settingLow: _.get(r, 'userLow.setting'),
                                        blocked: r.blockedHigh || r.blockedLow,
                                        userId: otherUserId
                                    };
                                }).compact().value();

                                return rows;
                            });
                        }
                    },
                    indexes: [
                        {
                            unique: true,
                            fields: ['userIdLow', 'userIdHigh'],
                            name: 'userIdLow_userIdHigh'
                        }
                    ],
                    hooks: {
                        beforeCreate: function (relation) {
                            //ensure userIdHigh is the higher of the pair of ids
                            if (relation.userIdHigh < relation.userIdLow) {
                                const swapValue = relation.userIdHigh;
                                relation.userIdHigh = relation.userIdLow;
                                relation.userIdLow = swapValue;
                            }

                            return relation;
                        }
                    }
                });

                Relation.belongsTo(User, {foreignKey: 'userIdLow', as: 'userLow'});
                Relation.belongsTo(User, {foreignKey: 'userIdHigh', as: 'userHigh'});

                Relation.RelationType = relationTypes;
        };
      };