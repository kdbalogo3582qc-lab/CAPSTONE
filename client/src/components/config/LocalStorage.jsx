const GetAccountId = () => {
    // Logic to get account ID
    const accountId = JSON.parse(localStorage.getItem('acc_id'));
    return accountId;
};

export default GetAccountId;