function goldFormat(m) {
    const copper = m % 100;
    m = (m - copper) / 100;
    const silver = m % 100;
    const gold = (m - silver) / 100;
    return {
        gold: gold,
        silver: silver,
        copper: copper
    }
}

function getItemRank(type) {
    switch (type) {
        case 'COMMON':
            return '⬜'
        case '-':
            return '🟩'
        case 'RARE':
            return '🟦'
        case 'EPIC':
            return '🟪'
        case '--':
            return '🟧'
    }
}

/**
 * Функция плюрализации окончаний
 *
 * @param integer number Число
 * @param array endings Окончания для значений [1, 2, 5]
 *
 * @returns string
 */
function plural(number, endings) {
    number = Math.abs(number);
    number %= 100;

    if (number >= 5 && number <= 20) {
        return endings[2];
    }

    number %= 10;
    if (number == 1) {
        return endings[0];
    }

    if (number >= 2 && number <= 4) {
        return endings[1];
    }

    return endings[2];
}

module.exports = {
    goldFormat,
    plural,
    getItemRank
}